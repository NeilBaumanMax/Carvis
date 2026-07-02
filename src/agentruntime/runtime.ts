import { randomUUID } from "node:crypto";

import type { MessageBus, MessageBusSubscription } from "../messagebus/index.js";
import type { AgentRole, AgentStatus } from "../shared/types/agent.js";
import type {
  AgentLifecyclePayload,
  AgentOutputPayload,
  CommandSubmittedPayload,
  OutputReadyPayload,
  RunCreatedPayload,
  RunPhaseChangedPayload,
  RuntimeHeartbeatPayload,
} from "../shared/types/events.js";
import type { RunPhase, RunState } from "../shared/types/run.js";
import type {
  AgentRuntimeOptions,
  RuntimePidAgent,
  RuntimeQueuedCommand,
  RuntimeRoleResult,
  RuntimeSnapshot,
} from "./types.js";
import { ENGINEER_ROLE, MANAGER_ROLE, PARALLEL_ROLES, ROLE_ORDER } from "./types.js";

export class AgentRuntime {
  private readonly queue: RuntimeQueuedCommand[] = [];
  private readonly agents = new Map<AgentRole, RuntimePidAgent>();
  private readonly subscriptions: MessageBusSubscription[] = [];
  private currentRun: RunState | undefined;
  private nextPid = 40_000;
  private running = false;

  constructor(
    private readonly bus: MessageBus,
    private readonly options: AgentRuntimeOptions = {},
  ) {}

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.subscriptions.push(
      this.bus.subscribe<CommandSubmittedPayload>(
        {
          type: "command.submitted",
          target: "agentruntime",
        },
        async (event) => {
          const requestId = event.requestId ?? randomUUID();
          this.queue.push({
            requestId,
            commandText: event.payload.commandText,
          });

          await this.publishHeartbeat();
          await this.drainQueue();
        },
      ),
    );
  }

  async shutdown(): Promise<void> {
    for (const agent of this.agents.values()) {
      if (agent.status !== "shutdown") {
        agent.status = "shutdown";
        agent.retained = false;
        agent.lastHeartbeatAt = new Date().toISOString();
        await this.publishAgentLifecycle("agent.shutdown", agent);
      }
    }

    await this.options.pidAgentPool?.shutdown();
    await this.publishHeartbeat();
    this.dispose();
  }

  getSnapshot(): RuntimeSnapshot {
    return {
      ...this.createHeartbeatPayload(),
      currentRun: this.currentRun === undefined ? undefined : { ...this.currentRun },
      agents: [...this.agents.values()].map((agent) => ({ ...agent })),
    };
  }

  dispose(): void {
    for (const subscription of this.subscriptions.splice(0)) {
      subscription.unsubscribe();
    }

    this.running = false;
  }

  private async drainQueue(): Promise<void> {
    if (this.currentRun !== undefined) {
      return;
    }

    while (this.queue.length > 0) {
      const command = this.queue.shift();

      if (command === undefined) {
        break;
      }

      await this.executeRun(command);
    }
  }

  private async executeRun(command: RuntimeQueuedCommand): Promise<void> {
    const now = new Date().toISOString();
    const run: RunState = {
      runId: `run-${randomUUID()}`,
      requestId: command.requestId,
      phase: "created",
      createdAt: now,
      updatedAt: now,
    };

    this.currentRun = run;

    try {
      await this.bus.publish<RunCreatedPayload>({
        type: "run.created",
        source: "agentruntime",
        target: "electron",
        requestId: run.requestId,
        runId: run.runId,
        payload: {
          commandText: command.commandText,
          phase: run.phase,
        },
      });

      await this.publishHeartbeat();
      await this.changePhase("parallel_roles_working");
      await Promise.all([MANAGER_ROLE, ...PARALLEL_ROLES].map((role) => this.runRole(role, command.commandText)));
      await this.changePhase("engineer_building");
      await this.runRole(ENGINEER_ROLE, command.commandText);
      await this.changePhase("output_ready");
      await this.publishOutputReady(command.commandText);
      await this.changePhase("retaining_agents");
    } catch (error) {
      console.error(
        `[agentruntime] run failed requestId=${run.requestId} error=${error instanceof Error ? error.message : String(error)}`,
      );
      await this.bus.publish<AgentOutputPayload>({
        type: "agent.output",
        source: "agentruntime",
        target: "electron",
        requestId: run.requestId,
        runId: run.runId,
        agentId: "manager",
        payload: {
          stream: "system",
          text: `RUN_ERROR: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
    } finally {
      this.currentRun = undefined;
      await this.publishHeartbeat();
    }
  }

  private async runRole(role: AgentRole, commandText: string): Promise<RuntimeRoleResult | undefined> {
    const agent = this.ensureAgent(role);
    let pidAgent = this.options.pidAgentPool?.getAgent(role);
    agent.retained = false;

    if (pidAgent !== undefined) {
      agent.pid = pidAgent.pid;
    }

    await this.setAgentStatus(agent, "starting", "agent.starting");
    await this.setAgentStatus(agent, "ready", "agent.ready");
    await this.setAgentStatus(agent, "working", "agent.output", `${role} working`);
    let pidOutput: string | undefined;
    let pidMetadata: unknown;
    if (pidAgent !== undefined) {
      const maxAttempts = Math.max(1, this.options.pidTaskMaxAttempts ?? 1);
      let previousPidOutput: string | undefined;
      let retryReason: string | undefined;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const pidInput =
          (await this.options.pidTaskInputBuilder?.({
            run: this.mustCurrentRun(),
            agent,
            commandText,
            attempt,
            previousPidOutput,
            retryReason,
          })) ?? `${role}: ${commandText}`;
        const startedAt = Date.now();
        let progressBusy = false;
        const progressTimer = setInterval(() => {
          if (progressBusy) {
            return;
          }

          progressBusy = true;
          const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
          void this.setAgentStatus(
            agent,
            "working",
            "agent.output",
            `${role} still running: attempt ${attempt}/${maxAttempts}, elapsed ${elapsedSeconds}s`,
          ).finally(() => {
            progressBusy = false;
          });
        }, 10_000);

        const activePidAgent = pidAgent;
        if (activePidAgent === undefined) {
          break;
        }

        let result: Awaited<ReturnType<typeof activePidAgent.runTask>>;
        try {
          result = await activePidAgent.runTask({
            input: pidInput,
            timeoutMs: this.options.pidTaskTimeoutMs,
            onOutput: (output) => {
              void this.setAgentStatus(agent, "working", "agent.output", output);
            },
          });
        } catch (error) {
          pidOutput = `PROVIDER_ERROR: ${error instanceof Error ? error.message : String(error)}`;
          await this.setAgentStatus(agent, "working", "agent.output", pidOutput);
          const validation = this.options.pidOutputValidator?.({
            run: this.mustCurrentRun(),
            agent,
            commandText,
            pidOutput,
            attempt,
            previousPidOutput,
            retryReason,
          }) ?? { ok: false, reason: "provider 调用失败" };

          if (attempt === maxAttempts) {
            await this.setAgentStatus(
              agent,
              "working",
              "agent.output",
              `${role} quality gate still failed after ${attempt} attempts: ${validation.reason ?? "provider 调用失败"}`,
            );
            break;
          }

          previousPidOutput = pidOutput;
          retryReason = validation.reason ?? "provider 调用失败";
          await this.setAgentStatus(
            agent,
            "working",
            "agent.output",
            `${role} provider failed, retrying attempt ${attempt + 1}/${maxAttempts}: ${retryReason}`,
          );
          pidAgent = this.options.pidAgentPool?.getAgent(role);
          if (pidAgent !== undefined) {
            agent.pid = pidAgent.pid;
          }
          continue;
        } finally {
          clearInterval(progressTimer);
        }

        agent.pid = result.pid;
        pidOutput = result.output;
        pidMetadata = result.metadata;
        await this.setAgentStatus(agent, "working", "agent.output", result.output);

        const validation = this.options.pidOutputValidator?.({
          run: this.mustCurrentRun(),
          agent,
          commandText,
          pidOutput,
          attempt,
          previousPidOutput,
          retryReason,
        }) ?? { ok: true };

        if (validation.ok || attempt === maxAttempts) {
          if (!validation.ok) {
            await this.setAgentStatus(
              agent,
              "working",
              "agent.output",
              `${role} quality gate still failed after ${attempt} attempts: ${validation.reason ?? "unknown reason"}`,
            );
          }
          break;
        }

        previousPidOutput = pidOutput;
        retryReason = validation.reason ?? "quality gate failed";
        await this.setAgentStatus(
          agent,
          "working",
          "agent.output",
          `${role} quality gate failed, retrying attempt ${attempt + 1}/${maxAttempts}: ${retryReason}`,
        );
      }
    }
    const roleResult = await this.options.roleRunner?.({
      run: this.mustCurrentRun(),
      agent,
      commandText,
      pidOutput,
      pidMetadata,
    });
    await this.setAgentStatus(agent, "done", "agent.done");
    agent.retained = true;
    await this.setAgentStatus(agent, "retained", "agent.retained");

    return roleResult ?? undefined;
  }

  private ensureAgent(role: AgentRole): RuntimePidAgent {
    const existing = this.agents.get(role);

    if (existing !== undefined) {
      return existing;
    }

    const agent: RuntimePidAgent = {
      agentId: role,
      role,
      pid: this.nextPid++,
      status: "idle",
      retained: false,
      workplacePath: `workplaces/${role}`,
    };

    this.agents.set(role, agent);
    return agent;
  }

  private async setAgentStatus(
    agent: RuntimePidAgent,
    status: AgentStatus,
    eventType: "agent.starting" | "agent.ready" | "agent.output" | "agent.done" | "agent.retained",
    outputText?: string,
  ): Promise<void> {
    agent.status = status;
    agent.lastHeartbeatAt = new Date().toISOString();

    if (eventType === "agent.output") {
      agent.lastOutputAt = agent.lastHeartbeatAt;
      await this.bus.publish<AgentOutputPayload>({
        type: "agent.output",
        source: "agentruntime",
        target: "electron",
        requestId: this.mustCurrentRun().requestId,
        runId: this.mustCurrentRun().runId,
        agentId: agent.agentId,
        payload: {
          stream: "system",
          text: outputText ?? `${agent.role} output`,
        },
      });
    } else {
      await this.publishAgentLifecycle(eventType, agent);
    }

    await this.publishHeartbeat();
  }

  private async shutdownRetainedAgents(): Promise<void> {
    for (const role of ROLE_ORDER) {
      const agent = this.agents.get(role);

      if (agent === undefined || agent.status === "shutdown") {
        continue;
      }

      agent.status = "shutdown";
      agent.retained = false;
      agent.lastHeartbeatAt = new Date().toISOString();
      await this.publishAgentLifecycle("agent.shutdown", agent);
    }

    await this.options.pidAgentPool?.shutdown();
    await this.publishHeartbeat();
  }

  private async changePhase(phase: RunPhase): Promise<void> {
    const run = this.mustCurrentRun();
    run.phase = phase;
    run.updatedAt = new Date().toISOString();

    await this.bus.publish<RunPhaseChangedPayload>({
      type: "run.phase.changed",
      source: "agentruntime",
      target: "electron",
      requestId: run.requestId,
      runId: run.runId,
      payload: {
        phase,
      },
    });
  }

  private async publishOutputReady(commandText: string): Promise<void> {
    const run = this.mustCurrentRun();
    const output = await this.createOutputReadyPayload(commandText);

    await this.bus.publish<OutputReadyPayload>({
      type: "output.ready",
      source: "agentruntime",
      target: "electron",
      requestId: run.requestId,
      runId: run.runId,
      payload: output,
    });
  }

  private async createOutputReadyPayload(commandText: string): Promise<OutputReadyPayload> {
    if (this.options.outputWriter !== undefined) {
      return this.options.outputWriter({
        run: this.mustCurrentRun(),
        agents: [...this.agents.values()].map((agent) => ({ ...agent })),
        commandText,
      });
    }

    return {
      outputPath: this.options.outputPath ?? "output/final-report.md",
      manifestPath: this.options.manifestPath ?? "output/manifest.json",
    };
  }

  private async publishAgentLifecycle(
    type: "agent.starting" | "agent.ready" | "agent.done" | "agent.retained" | "agent.shutdown",
    agent: RuntimePidAgent,
  ): Promise<void> {
    const run = this.currentRun;

    await this.bus.publish<AgentLifecyclePayload>({
      type,
      source: "agentruntime",
      target: "electron",
      requestId: run?.requestId,
      runId: run?.runId,
      agentId: agent.agentId,
      payload: {
        role: agent.role,
        status: agent.status,
        pid: agent.pid,
        workplacePath: agent.workplacePath,
      },
    });
  }

  private async publishHeartbeat(): Promise<void> {
    const run = this.currentRun;

    await this.bus.publish<RuntimeHeartbeatPayload>({
      type: "runtime.heartbeat",
      source: "agentruntime",
      target: "electron",
      requestId: run?.requestId,
      runId: run?.runId,
      payload: this.createHeartbeatPayload(),
    });
  }

  private createHeartbeatPayload(): RuntimeHeartbeatPayload {
    const agents = [...this.agents.values()];

    return {
      activePidCount: agents.filter((agent) => agent.status === "working").length,
      idlePidCount: agents.filter((agent) => agent.status === "idle" || agent.status === "ready").length,
      retainedPidCount: agents.filter((agent) => agent.retained).length,
      queueDepth: this.queue.length,
    };
  }

  private mustCurrentRun(): RunState {
    if (this.currentRun === undefined) {
      throw new Error("expected active run");
    }

    return this.currentRun;
  }
}

export function createAgentRuntime(bus: MessageBus, options?: AgentRuntimeOptions): AgentRuntime {
  return new AgentRuntime(bus, options);
}
