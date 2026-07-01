import type { AgentRole, AgentRuntimeState } from "../shared/types/agent.js";
import type { OutputReadyPayload } from "../shared/types/events.js";
import type { RunState } from "../shared/types/run.js";

export type RuntimeRoleRunner = (context: RuntimeRoleContext) => void | Promise<void>;

export interface RuntimeRoleContext {
  run: RunState;
  agent: AgentRuntimeState;
}

export type RuntimeOutputWriter = (context: RuntimeOutputContext) => OutputReadyPayload | Promise<OutputReadyPayload>;

export interface RuntimeOutputContext {
  run: RunState;
  agents: AgentRuntimeState[];
}

export interface AgentRuntimeOptions {
  roleRunner?: RuntimeRoleRunner;
  outputWriter?: RuntimeOutputWriter;
  outputPath?: string;
  manifestPath?: string;
}

export interface RuntimeSnapshot {
  activePidCount: number;
  idlePidCount: number;
  retainedPidCount: number;
  queueDepth: number;
  currentRun?: RunState;
  agents: AgentRuntimeState[];
}

export interface RuntimePidAgent extends AgentRuntimeState {
  retained: boolean;
}

export interface RuntimeQueuedCommand {
  requestId: string;
  commandText: string;
}

export const MANAGER_ROLE: AgentRole = "manager";
export const PARALLEL_ROLES: AgentRole[] = ["writer", "artist", "researcher"];
export const ENGINEER_ROLE: AgentRole = "engineer";
export const ROLE_ORDER: AgentRole[] = [MANAGER_ROLE, ...PARALLEL_ROLES, ENGINEER_ROLE];
