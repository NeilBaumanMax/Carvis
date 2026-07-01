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
    await this.changePhase("manager_planning");
    await this.runRole(MANAGER_ROLE, command.commandText);
    await this.changePhase("parallel_roles_working");
    await Promise.all(PARALLEL_ROLES.map((role) => this.runRole(role, command.commandText)));
    await this.changePhase("engineer_building");
    await this.runRole(ENGINEER_ROLE, command.commandText);
    await this.changePhase("output_ready");
    await this.publishOutputReady();
    await this.changePhase("retaining_agents");
    await this.shutdownRetainedAgents();
    await this.changePhase("shutdown");
    this.currentRun = undefined;
    await this.publishHeartbeat();
  }

  private async runRole(role: AgentRole, commandText: string): Promise<void> {
    const agent = this.ensureAgent(role);
    const pidAgent = this.options.pidAgentPool?.getAgent(role);

    if (pidAgent !== undefined) {
      agent.pid = pidAgent.pid;
    }

    await this.setAgentStatus(agent, "starting", "agent.starting");
    await this.setAgentStatus(agent, "ready", "agent.ready");
    await this.setAgentStatus(agent, "working", "agent.output", `${role} working`);
    if (pidAgent !== undefined) {
      const result = await pidAgent.runTask({
        input: `${role}: ${commandText}`,
        timeoutMs: this.options.pidTaskTimeoutMs,
      });

      agent.pid = result.pid;
      await this.setAgentStatus(agent, "working", "agent.output", result.output);
    }
    await this.options.roleRunner?.({
      run: this.mustCurrentRun(),
      agent,
      commandText,
    });
    await this.setAgentStatus(agent, "done", "agent.done");
    agent.retained = true;
    await this.setAgentStatus(agent, "retained", "agent.retained");
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

  private async publishOutputReady(): Promise<void> {
    const run = this.mustCurrentRun();
    const output = await this.createOutputReadyPayload();

    await this.bus.publish<OutputReadyPayload>({
      type: "output.ready",
      source: "agentruntime",
      target: "electron",
      requestId: run.requestId,
      runId: run.runId,
      payload: output,
    });
  }

  private async createOutputReadyPayload(): Promise<OutputReadyPayload> {
    if (this.options.outputWriter !== undefined) {
      return this.options.outputWriter({
        run: this.mustCurrentRun(),
        agents: [...this.agents.values()].map((agent) => ({ ...agent })),
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
