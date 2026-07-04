import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { MessageBus } from "../messagebus/index.js";
import type { AgentRole, AgentRuntimeState, AgentStatus } from "../shared/types/agent.js";
import type {
  OutputReadyPayload,
  RuntimeHeartbeatPayload,
} from "../shared/types/events.js";
import type { RunState, UserCommand } from "../shared/types/run.js";
import { runClaudeCodeAgent } from "./claudecode/agent.js";
import type { AgentRuntimeSnapshot, MockRunResult } from "./types.js";
import { createWorkplaces, type Workplaces } from "./workplaces/index.js";

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
  private readonly workplaces: Workplaces;

  constructor(
    workspaceRoot = "workplaces",
    private readonly outputDir = "output",
  ) {
    this.workplaces = createWorkplaces({ rootDir: workspaceRoot });
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

  async writeTaskFile(role: AgentRole, content: string): Promise<string> {
    return await this.workplaces.writeTaskFile(role, content);
  }

  async readRoleOutput(role: AgentRole): Promise<string> {
    return await this.workplaces.readRoleOutput(role);
  }

  async runCommand(
    bus: MessageBus,
    commandText: string,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<MockRunResult> {
    if (env.CARVIS_CLAUDE_MODE === "real") {
      return await this.runRealCommand(bus, commandText, env);
    }

    return await this.runMockCommand(bus, commandText);
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

    await this.workplaces.ensure();
    this.commandQueue.shift();

    await this.writeTaskFile("manager", commandText);
    await this.markRole(bus, "manager", "working", roleFlow);
    await this.workplaces.writePlan("manager", `Mock task plan for: ${commandText}\n`);
    await this.workplaces.writeRoleOutput("manager", "manager mock plan complete\n");
    await this.markRole(bus, "manager", "done", roleFlow);

    run.phase = "parallel_roles_working";
    this.touchRun();

    await Promise.all(
      (["writer", "artist", "researcher"] as const).map(async (role) => {
        await this.writeTaskFile(role, `${role} mock task for: ${commandText}\n`);
        await this.markRole(bus, role, "working", roleFlow);
      }),
    );

    await Promise.all(
      (["writer", "artist", "researcher"] as const).map(async (role) => {
        await this.workplaces.writeRoleOutput(role, `${role} mock result for ${commandText}\n`);
        await this.markRole(bus, role, "done", roleFlow);
      }),
    );

    run.phase = "engineer_building";
    this.touchRun();

    await this.markRole(bus, "engineer", "working", roleFlow);
    await this.writeTaskFile("engineer", `Summarize mock role outputs for: ${commandText}\n`);
    await this.workplaces.writeRoleOutput("engineer", "engineer mock output complete\n");
    await this.markRole(bus, "engineer", "done", roleFlow);

    run.phase = "output_ready";
    this.touchRun();

    const outputPath = await this.writeOutputFiles(run.runId, commandText);
    await bus.publish<OutputReadyPayload>({
      type: "output.ready",
      source: "agentruntime",
      target: "electron",
      requestId: command.requestId,
      runId: run.runId,
      payload: {
        outputPath,
        manifestPath: join(this.outputDir, "manifest.json"),
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

  async runRealCommand(
    bus: MessageBus,
    commandText: string,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<MockRunResult> {
    const command: UserCommand = {
      requestId: `req-${randomUUID()}`,
      text: commandText,
      submittedAt: new Date().toISOString(),
    };
    this.commandQueue.push(command);

    const run = this.createRun(command);
    const roleFlow: string[] = [];

    await this.workplaces.ensure();
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

    await this.writeTaskFile("manager", commandText);
    await this.markRole(bus, "manager", "working", roleFlow);
    const managerOutput = await this.runRoleAgent(bus, "manager", commandText, env, run.runId, command.requestId);
    await this.workplaces.writePlan("manager", managerOutput.stdout);
    await this.workplaces.writeRoleOutput("manager", managerOutput.stdout);
    await this.markRole(bus, "manager", "done", roleFlow);

    run.phase = "parallel_roles_working";
    this.touchRun();

    const parallelRoles = ["writer", "artist", "researcher"] as const;
    await Promise.all(
      parallelRoles.map(async (role) => {
        const task = buildRoleTask(role, commandText, managerOutput.stdout);
        await this.writeTaskFile(role, task);
        await this.markRole(bus, role, "working", roleFlow);
        const output = await this.runRoleAgent(bus, role, task, env, run.runId, command.requestId);
        await this.workplaces.writeRoleOutput(role, output.stdout);
        await this.markRole(bus, role, "done", roleFlow);
      }),
    );

    run.phase = "engineer_building";
    this.touchRun();

    const writerOutput = await this.readRoleOutput("writer");
    const artistOutput = await this.readRoleOutput("artist");
    const researcherOutput = await this.readRoleOutput("researcher");
    const engineerTask = buildEngineerTask(commandText, writerOutput, artistOutput, researcherOutput);

    await this.writeTaskFile("engineer", engineerTask);
    await this.markRole(bus, "engineer", "working", roleFlow);
    const engineerOutput = await this.runRoleAgent(bus, "engineer", engineerTask, env, run.runId, command.requestId);
    await this.workplaces.writeRoleOutput("engineer", engineerOutput.stdout);
    await this.markRole(bus, "engineer", "done", roleFlow);

    run.phase = "output_ready";
    this.touchRun();

    const outputPath = await this.writeOutputFiles(run.runId, commandText, engineerOutput.stdout);
    await bus.publish<OutputReadyPayload>({
      type: "output.ready",
      source: "agentruntime",
      target: "electron",
      requestId: command.requestId,
      runId: run.runId,
      payload: {
        outputPath,
        manifestPath: join(this.outputDir, "manifest.json"),
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

  private async runRoleAgent(
    bus: MessageBus,
    role: AgentRole,
    prompt: string,
    env: NodeJS.ProcessEnv,
    runId: string,
    requestId: string,
  ) {
    try {
      return await runClaudeCodeAgent({
        role,
        prompt,
        cwd: this.workplaces.getRolePath(role),
        env,
        bus,
        runId,
        requestId,
        agentId: role,
      });
    } catch (error) {
      await this.markRole(bus, role, "failed", []);
      throw error;
    }
  }

  private async writeOutputFiles(
    runId: string,
    commandText: string,
    content = "Carvis mock final report\n",
  ): Promise<string> {
    await mkdir(join(this.outputDir, "artifacts"), { recursive: true });

    const outputPath = join(this.outputDir, "final-report.md");
    const manifestPath = join(this.outputDir, "manifest.json");
    const finalReport = [
      "# Carvis Final Report",
      "",
      `Run: ${runId}`,
      `Command: ${commandText}`,
      "",
      content.trim(),
      "",
    ].join("\n");

    await writeFile(outputPath, finalReport);
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          runId,
          outputPath,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    return outputPath;
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

export function createAgentRuntime(workspaceRoot?: string, outputDir?: string): AgentRuntime {
  return new AgentRuntime(workspaceRoot, outputDir);
}

function buildRoleTask(role: AgentRole, commandText: string, managerPlan: string): string {
  return [
    `User command: ${commandText}`,
    "",
    "Manager plan:",
    managerPlan,
    "",
    `Produce the ${role} role output for this Carvis run.`,
  ].join("\n");
}

function buildEngineerTask(
  commandText: string,
  writerOutput: string,
  artistOutput: string,
  researcherOutput: string,
): string {
  return [
    `User command: ${commandText}`,
    "",
    "Writer output:",
    writerOutput,
    "",
    "Artist output:",
    artistOutput,
    "",
    "Researcher output:",
    researcherOutput,
    "",
    "Create the final product summary for output/final-report.md.",
  ].join("\n");
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
