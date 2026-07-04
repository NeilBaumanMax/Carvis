import { randomUUID } from "node:crypto";

import type { AgentRole } from "../shared/types/agent.js";
import type { RunPhase } from "../shared/types/run.js";
import type { RuntimeBusClient } from "./messagebus/client.js";
import type { AgentPool } from "./pool.js";
import type { RuntimeConfig, SchedulerState, TaskItem } from "./types.js";
import { ROLE_FLOW } from "./types.js";

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

    // Publish corresponding event
    if (status === "starting") {
      await busClient.publishAgentEvent("agent.starting", agent.agentId, currentRunId);
    } else if (status === "ready") {
      await busClient.publishAgentEvent("agent.ready", agent.agentId, currentRunId);
      await busClient.publishAgentOutput(
        agent.agentId,
        `${agent.role} agent ready`,
        "system",
      );
    } else if (status === "done") {
      await busClient.publishAgentEvent("agent.done", agent.agentId, currentRunId);
      await busClient.publishAgentOutput(
        agent.agentId,
        `${agent.role} agent task completed`,
        "system",
      );
    }
  }

  async function executeSequential(role: AgentRole): Promise<void> {
    const agent = ensureAgent(role);
    await transitionAgent(role, "starting");
    await transitionAgent(role, "ready");
    await transitionAgent(role, "assigned");
    await transitionAgent(role, "working");

    // Simulate work
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

  async function executeParallel(roles: AgentRole[]): Promise<void> {
    // Start all agents
    for (const role of roles) {
      const agent = ensureAgent(role);
      await transitionAgent(role, "starting");
      await transitionAgent(role, "ready");
      await transitionAgent(role, "assigned");
      await transitionAgent(role, "working");
      await busClient.publishAgentOutput(
        agent.agentId,
        `${role} agent working on sub-task`,
        "stdout",
      );
    }

    // Wait for all to complete (simulated)
    for (const role of roles) {
      const agent = pool.getAgent(role);
      if (agent === undefined) {
        continue;
      }
      await transitionAgent(role, "done");
      pool.transitionAgent(agent.agentId, "retained");
      await busClient.publishAgentEvent("agent.retained", agent.agentId, currentRunId);
      roleCompletion.set(role, true);
    }
  }

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

      // Phase transitions
      if (phase === "created") {
        phase = "manager_planning";
        await executeSequential("manager");
        phase = "parallel_roles_working";
        return snapshot();
      }

      if (phase === "parallel_roles_working") {
        const parallelRoles = ROLE_FLOW.find(
          (step) => step.kind === "parallel",
        );
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
        await busClient.publishAgentOutput(
          "system",
          `output ready at ${config.outputDir}`,
          "system",
        );

        // Broadcast output.ready
        await busClient.publishAgentEvent("output.ready", "system", currentRunId);

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
      // Transition all retained/done agents to shutdown
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

      // Shutdown any remaining agents
      pool.shutdownAll();

      phase = "shutdown";
      queue.length = 0;
      pool.queueDepth = 0;
      currentRunId = undefined;

      return snapshot();
    },
  };
}
