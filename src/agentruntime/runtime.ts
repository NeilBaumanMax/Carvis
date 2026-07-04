import { randomUUID } from "node:crypto";

import type { MessageBus } from "../messagebus/index.js";
import type { AgentRole, AgentRuntimeState, AgentStatus } from "../shared/types/agent.js";
import type {
  OutputReadyPayload,
  RuntimeHeartbeatPayload,
} from "../shared/types/events.js";
import type { RunState, UserCommand } from "../shared/types/run.js";
import type { AgentRuntimeSnapshot, MockRunResult } from "./types.js";

export const AGENT_RUNTIME_ROLES: readonly AgentRole[] = [
  "manager",
  "writer",
  "artist",
  "researcher",
  "engineer",
];

export class AgentRuntime {
  private run?: RunState;
  private readonly commandQueue: UserCommand[] = [];
  private readonly agents: AgentRuntimeState[];

  constructor(workspaceRoot = "workplaces") {
    this.agents = AGENT_RUNTIME_ROLES.map((role) => ({
      agentId: role,
      role,
      workplacePath: `${workspaceRoot}/${role}`,
      status: "idle",
    }));
  }

  getSnapshot(): AgentRuntimeSnapshot {
    return {
      run: this.run === undefined ? undefined : { ...this.run },
      commandQueue: this.commandQueue.map((command) => ({ ...command })),
      agents: this.agents.map((agent) => ({ ...agent })),
    };
  }

  createHeartbeatPayload(): RuntimeHeartbeatPayload {
    return {
      activePidCount: this.countAgents(["starting", "ready", "assigned", "working", "waiting"]),
      idlePidCount: this.countAgents(["idle"]),
      retainedPidCount: this.countAgents(["retained"]),
      queueDepth: this.commandQueue.length,
    };
  }

  async publishHeartbeat(bus: MessageBus): Promise<void> {
    await bus.publish<RuntimeHeartbeatPayload>({
      type: "runtime.heartbeat",
      source: "agentruntime",
      target: "electron",
      runId: this.run?.runId,
      payload: this.createHeartbeatPayload(),
    });
  }

  async runMockCommand(bus: MessageBus, commandText: string): Promise<MockRunResult> {
    const command: UserCommand = {
      requestId: `req-${randomUUID()}`,
      text: commandText,
      submittedAt: new Date().toISOString(),
    };
    this.commandQueue.push(command);

    const run = this.createRun(command);
    const roleFlow: string[] = [];

    await bus.publish({
      type: "run.created",
      source: "agentruntime",
      target: "electron",
      requestId: command.requestId,
      runId: run.runId,
      payload: {
        phase: run.phase,
      },
    });

    this.commandQueue.shift();

    await this.markRole(bus, "manager", "working", roleFlow);
    await this.markRole(bus, "manager", "done", roleFlow);

    run.phase = "parallel_roles_working";
    this.touchRun();

    await Promise.all([
      this.markRole(bus, "writer", "working", roleFlow),
      this.markRole(bus, "artist", "working", roleFlow),
      this.markRole(bus, "researcher", "working", roleFlow),
    ]);

    await Promise.all([
      this.markRole(bus, "writer", "done", roleFlow),
      this.markRole(bus, "artist", "done", roleFlow),
      this.markRole(bus, "researcher", "done", roleFlow),
    ]);

    run.phase = "engineer_building";
    this.touchRun();

    await this.markRole(bus, "engineer", "working", roleFlow);
    await this.markRole(bus, "engineer", "done", roleFlow);

    run.phase = "output_ready";
    this.touchRun();

    const outputPath = "output/final-report.md";
    await bus.publish<OutputReadyPayload>({
      type: "output.ready",
      source: "agentruntime",
      target: "electron",
      requestId: command.requestId,
      runId: run.runId,
      payload: {
        outputPath,
        manifestPath: "output/manifest.json",
      },
    });

    run.phase = "retaining_agents";
    this.touchRun();

    for (const role of AGENT_RUNTIME_ROLES) {
      await this.markRole(bus, role, "retained", roleFlow);
    }

    return {
      runId: run.runId,
      roleFlow,
      outputPath,
    };
  }

  private createRun(command: UserCommand): RunState {
    const now = new Date().toISOString();
    this.run = {
      runId: `run-${randomUUID()}`,
      requestId: command.requestId,
      phase: "manager_planning",
      createdAt: now,
      updatedAt: now,
    };

    return this.run;
  }

  private touchRun(): void {
    if (this.run !== undefined) {
      this.run.updatedAt = new Date().toISOString();
    }
  }

  private async markRole(
    bus: MessageBus,
    role: AgentRole,
    status: AgentStatus,
    roleFlow: string[],
  ): Promise<void> {
    const agent = this.findAgent(role);
    agent.status = status;
    agent.lastHeartbeatAt = new Date().toISOString();
    roleFlow.push(`${role}:${status}`);

    await bus.publish({
      type: statusToEventType(status),
      source: "agentruntime",
      target: "electron",
      runId: this.run?.runId,
      agentId: agent.agentId,
      payload: {
        role,
        status,
      },
    });
  }

  private findAgent(role: AgentRole): AgentRuntimeState {
    const agent = this.agents.find((candidate) => candidate.role === role);

    if (agent === undefined) {
      throw new Error(`missing runtime agent for role ${role}`);
    }

    return agent;
  }

  private countAgents(statuses: readonly AgentStatus[]): number {
    return this.agents.filter((agent) => statuses.includes(agent.status)).length;
  }
}

export function createAgentRuntime(workspaceRoot?: string): AgentRuntime {
  return new AgentRuntime(workspaceRoot);
}

function statusToEventType(status: AgentStatus) {
  switch (status) {
    case "starting":
      return "agent.starting";
    case "ready":
      return "agent.ready";
    case "done":
      return "agent.done";
    case "retained":
      return "agent.retained";
    case "failed":
      return "agent.error";
    case "shutdown":
      return "agent.shutdown";
    case "idle":
    case "assigned":
    case "working":
    case "waiting":
      return "agent.output";
  }
}
