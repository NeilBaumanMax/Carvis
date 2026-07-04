import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";

import type { AgentRole } from "../shared/types/agent.js";
import type { RunPhase } from "../shared/types/run.js";
import type { RuntimeBusClient } from "./messagebus/client.js";
import type { AgentPool } from "./pool.js";
import type { RuntimeConfig, SchedulerState, TaskItem } from "./types.js";
import { ROLE_FLOW } from "./types.js";
import { createWorkplaceManager } from "./workplaces/manager.js";
import { createOutputManager } from "./output/manager.js";
import { createAgentManager, defaultRolePrompts, isClaudeCodeAvailable } from "./claudecode/index.js";
import type { AgentManager, ClaudeCodeAgent } from "./claudecode/index.js";

export interface TaskScheduler {
  submitTask(commandText: string, requestId?: string): TaskItem;
  getState(): SchedulerState;
  advance(): Promise<SchedulerState>;
  shutdown(): Promise<SchedulerState>;
}

export function createTaskScheduler(
  config: RuntimeConfig,
  pool: AgentPool,
  busClient: RuntimeBusClient,
): TaskScheduler {
  const queue: TaskItem[] = [];
  let currentRunId: string | undefined;
  let phase: RunPhase = "created";
  let startedAt: string | undefined;
  const roleCompletion = new Map<AgentRole, boolean>();

  const wm = createWorkplaceManager(config.workplaceRoot);
  const om = createOutputManager(config.outputDir);

  // Lazily created when claude mode is active
  let agentManager: AgentManager | undefined;

  // Detect effective mode: "claude" only if CLI is available, otherwise fall back to mock
  let effectiveMode: "mock" | "claude" = config.executionMode;
  if (effectiveMode === "claude" && !isClaudeCodeAvailable()) {
    console.warn("[scheduler] claude mode requested but CLI not available, falling back to mock");
    effectiveMode = "mock";
  }

  console.log(`[scheduler] execution mode: ${effectiveMode}`);

  function now(): string {
    return new Date().toISOString();
  }

  function snapshot(): SchedulerState {
    return {
      currentRunId,
      phase,
      queue: [...queue],
      pool: pool.getSnapshot(),
      startedAt,
      updatedAt: now(),
    };
  }

  function ensureAgent(role: AgentRole) {
    const existing = pool.getAgent(role);
    if (existing !== undefined) {
      return existing;
    }
    return pool.createAgent(role);
  }

  async function transitionAgent(role: AgentRole, status: string) {
    const agent = pool.getAgent(role);
    if (agent === undefined) {
      return;
    }

    const agentStatus = status as "starting" | "ready" | "assigned" | "working" | "done" | "retained" | "shutdown";
    pool.transitionAgent(agent.agentId, agentStatus);

    if (status === "starting") {
      await busClient.publishAgentEvent("agent.starting", agent.agentId, currentRunId);
    } else if (status === "ready") {
      await busClient.publishAgentEvent("agent.ready", agent.agentId, currentRunId);
      await busClient.publishAgentOutput(agent.agentId, `${agent.role} agent ready`, "system");
    } else if (status === "done") {
      await busClient.publishAgentEvent("agent.done", agent.agentId, currentRunId);
      await busClient.publishAgentOutput(agent.agentId, `${agent.role} agent task completed`, "system");
    }
  }

  async function executeSequentialMock(role: AgentRole): Promise<void> {
    const agent = ensureAgent(role);
    await transitionAgent(role, "starting");
    await transitionAgent(role, "ready");
    await transitionAgent(role, "assigned");
    await transitionAgent(role, "working");

    await busClient.publishAgentOutput(
      agent.agentId,
      `${role} agent processing task: ${queue[0]?.commandText ?? "no task"}`,
      "stdout",
    );

    await transitionAgent(role, "done");
    pool.transitionAgent(agent.agentId, "retained");
    await busClient.publishAgentEvent("agent.retained", agent.agentId, currentRunId);
    roleCompletion.set(role, true);
  }

  async function executeParallelMock(roles: AgentRole[]): Promise<void> {
    for (const role of roles) {
      const agent = ensureAgent(role);
      await transitionAgent(role, "starting");
      await transitionAgent(role, "ready");
      await transitionAgent(role, "assigned");
      await transitionAgent(role, "working");
      await busClient.publishAgentOutput(agent.agentId, `${role} agent working on sub-task`, "stdout");
    }

    for (const role of roles) {
      const agent = pool.getAgent(role);
      if (agent === undefined) continue;
      await transitionAgent(role, "done");
      pool.transitionAgent(agent.agentId, "retained");
      await busClient.publishAgentEvent("agent.retained", agent.agentId, currentRunId);
      roleCompletion.set(role, true);
    }
  }

  // --- Claude Code real execution ---

  function getAgentMgr(): AgentManager {
    if (agentManager === undefined) {
      agentManager = createAgentManager(config, busClient);
    }
    return agentManager;
  }

  async function executeSequentialClaude(role: AgentRole): Promise<void> {
    const agent = ensureAgent(role);
    const prompts = defaultRolePrompts();
    const rp = prompts[role];
    const task = queue[0]?.commandText ?? "no task";
    const started = now();
    const fullPrompt = `${rp.userPrompt}\n\n## Task\n\n${task}`;

    // Write prompt to workplace input.md for audit trail
    const resultPath = join(config.workplaceRoot, role, "result.md");
    try {
      await wm.writeFile(role, "input.md", `# ${role} Input\n\n${fullPrompt}\n`);
    } catch {
      // non-fatal: input.md may already exist
    }

    await transitionAgent(role, "starting");
    await transitionAgent(role, "ready");
    await transitionAgent(role, "assigned");
    await transitionAgent(role, "working");

    await busClient.publishAgentOutput(
      agent.agentId,
      `[claude] spawning ${role} agent for task: ${task}`,
      "system",
    );

    const claudeAgent: ClaudeCodeAgent = getAgentMgr().startAgent(
      role,
      agent.agentId,
      currentRunId,
      [fullPrompt],
    );

    let exitCode: number | null = null;
    let exitSignal: string | null = null;
    let errorMessage: string | undefined;

    try {
      const exitResult = await claudeAgent.waitForExit();
      exitCode = exitResult.code;
      exitSignal = exitResult.signal;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    // Write result.md
    const resultContent = [
      `# ${role} Result`,
      `- runId: ${currentRunId ?? "unknown"}`,
      `- task: ${task}`,
      `- startedAt: ${started}`,
      `- completedAt: ${now()}`,
      exitCode !== null ? `- exitCode: ${exitCode}` : null,
      exitSignal ? `- signal: ${exitSignal}` : null,
      errorMessage ? `- error: ${errorMessage}` : null,
      ``,
      `Output is available via the messagebus on agent.output events (agentId=${agent.agentId}).`,
    ].filter(Boolean).join("\n");

    try {
      await writeFile(resultPath, resultContent, "utf-8");
    } catch (err) {
      console.warn(`[scheduler] failed to write result.md for ${role}: ${err instanceof Error ? err.message : err}`);
    }

    await transitionAgent(role, "done");
    pool.transitionAgent(agent.agentId, "retained");
    await busClient.publishAgentEvent("agent.retained", agent.agentId, currentRunId);
    roleCompletion.set(role, true);
  }

  async function executeParallelClaude(roles: AgentRole[]): Promise<void> {
    // Start all agents in parallel
    const agents: { role: AgentRole; agent: ClaudeCodeAgent }[] = [];

    for (const role of roles) {
      const pooled = ensureAgent(role);
      const prompts = defaultRolePrompts();
      const rp = prompts[role];
      const task = queue[0]?.commandText ?? "no task";
      const fullPrompt = `${rp.userPrompt}\n\n## Task\n\n${task}`;

      try {
        await wm.writeFile(role, "input.md", `# ${role} Input\n\n${fullPrompt}\n`);
      } catch {
        // non-fatal
      }

      await transitionAgent(role, "starting");
      await transitionAgent(role, "ready");
      await transitionAgent(role, "assigned");
      await transitionAgent(role, "working");

      await busClient.publishAgentOutput(
        pooled.agentId,
        `[claude] spawning ${role} agent`,
        "system",
      );

      const claudeAgent = getAgentMgr().startAgent(role, pooled.agentId, currentRunId, [fullPrompt]);
      agents.push({ role, agent: claudeAgent });
    }

    // Wait for all to complete
    await Promise.all(
      agents.map(async (entry) => {
        try {
          const exitResult = await entry.agent.waitForExit();
          await busClient.publishAgentOutput(
            ensureAgent(entry.role).agentId,
            `[claude] ${entry.role} agent exited with code ${exitResult.code}`,
            "system",
          );
        } catch (err) {
          await busClient.publishAgentOutput(
            ensureAgent(entry.role).agentId,
            `[claude] ${entry.role} agent error: ${err instanceof Error ? err.message : String(err)}`,
            "system",
          );
        }

        // Write result.md
        const resultContent = [
          `# ${entry.role} Result`,
          `- runId: ${currentRunId ?? "unknown"}`,
          `- task: ${queue[0]?.commandText ?? "no task"}`,
          `- completedAt: ${now()}`,
          ``,
          `Output is available via the messagebus on agent.output events.`,
        ].join("\n");

        const resultPath = join(config.workplaceRoot, entry.role, "result.md");
        try {
          await writeFile(resultPath, resultContent, "utf-8");
        } catch (err) {
          console.warn(`[scheduler] failed to write result.md for ${entry.role}`);
        }
      }),
    );

    // Transition all to retained
    for (const entry of agents) {
      await transitionAgent(entry.role, "done");
      const pooled = pool.getAgent(entry.role);
      if (pooled !== undefined) {
        pool.transitionAgent(pooled.agentId, "retained");
        await busClient.publishAgentEvent("agent.retained", pooled.agentId, currentRunId);
      }
      roleCompletion.set(entry.role, true);
    }
  }

  // Use mock or claude based on config
  const executeSequential = effectiveMode === "claude" ? executeSequentialClaude : executeSequentialMock;
  const executeParallel = effectiveMode === "claude" ? executeParallelClaude : executeParallelMock;

  return {
    submitTask(commandText, requestId) {
      const runId = `run-${randomUUID().slice(0, 8)}`;
      const task: TaskItem = {
        runId,
        requestId,
        commandText,
        createdAt: now(),
      };
      queue.push(task);

      if (queue.length === 1) {
        currentRunId = runId;
        phase = "created";
        startedAt = now();
      }

      pool.queueDepth = queue.length;
      return task;
    },

    getState() {
      return snapshot();
    },

    async advance() {
      if (queue.length === 0) {
        return snapshot();
      }

      if (phase === "created") {
        phase = "manager_planning";
        await executeSequential("manager");
        phase = "parallel_roles_working";
        return snapshot();
      }

      if (phase === "parallel_roles_working") {
        const parallelRoles = ROLE_FLOW.find((step) => step.kind === "parallel");
        if (parallelRoles !== undefined && parallelRoles.kind === "parallel") {
          await executeParallel(parallelRoles.roles);
        }
        phase = "engineer_building";
        return snapshot();
      }

      if (phase === "engineer_building") {
        await executeSequential("engineer");
        phase = "output_ready";
        return snapshot();
      }

      if (phase === "output_ready") {
        await wm.initAll();

        const manifest = await om.generateOutput(currentRunId!, wm);
        const manifestPath = join(om.outputPath, "manifest.json");

        await busClient.publishAgentOutput(
          "system",
          `output ready at ${om.outputPath} (${manifest.files.length} files)`,
          "system",
        );

        await busClient.publishOutputReady(om.outputPath, manifestPath, currentRunId);

        phase = "retaining_agents";
        pool.queueDepth = Math.max(0, queue.length - 1);
        return snapshot();
      }

      if (phase === "retaining_agents") {
        phase = "shutdown";
        return snapshot();
      }

      return snapshot();
    },

    async shutdown() {
      // Shut down Claude Code agents if running
      if (agentManager !== undefined) {
        agentManager.shutdownAll();
      }

      for (const [role, completed] of roleCompletion) {
        if (completed) {
          const agent = pool.getAgent(role);
          if (agent !== undefined) {
            try {
              pool.transitionAgent(agent.agentId, "shutdown");
              await busClient.publishAgentEvent("agent.shutdown", agent.agentId, currentRunId);
            } catch {
              // agent may already be shutdown
            }
          }
        }
      }

      pool.shutdownAll();

      phase = "shutdown";
      queue.length = 0;
      pool.queueDepth = 0;
      currentRunId = undefined;

      return snapshot();
    },
  };
}
