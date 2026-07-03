import type { AgentRole, AgentRuntimeState } from "../shared/types/agent.js";
import type { OutputReadyPayload } from "../shared/types/events.js";
import type { RunState } from "../shared/types/run.js";
import type { PersistentPidAgentPool } from "./pidagent/index.js";

export type RuntimeRoleRunner = (context: RuntimeRoleContext) => RuntimeRoleResult | void | Promise<RuntimeRoleResult | void>;

export interface RuntimeRoleResult {
  gatePassed?: boolean;
}

export interface RuntimeRoleContext {
  run: RunState;
  agent: AgentRuntimeState;
  commandText: string;
  pidOutput?: string;
  pidMetadata?: unknown;
  attempt?: number;
  previousPidOutput?: string;
  retryReason?: string;
}

export type RuntimeOutputWriter = (context: RuntimeOutputContext) => OutputReadyPayload | Promise<OutputReadyPayload>;
export type RuntimePidTaskInputBuilder = (context: RuntimeRoleContext) => string | Promise<string>;
export type RuntimePidOutputValidator = (context: RuntimeRoleContext) => RuntimePidOutputValidation;

export interface RuntimePidOutputValidation {
  ok: boolean;
  reason?: string;
}

export interface RuntimeOutputContext {
  run: RunState;
  agents: AgentRuntimeState[];
  commandText: string;
}

export interface AgentRuntimeOptions {
  roleRunner?: RuntimeRoleRunner;
  pidTaskInputBuilder?: RuntimePidTaskInputBuilder;
  pidAgentPool?: PersistentPidAgentPool;
  pidTaskTimeoutMs?: number;
  pidTaskMaxAttempts?: number | ((context: RuntimeRoleContext) => number);
  pidOutputValidator?: RuntimePidOutputValidator;
  engineerRunsAfterFailedReview?: boolean;
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
  speedMode?: "auto" | "fast" | "full";
}

export const MANAGER_ROLE: AgentRole = "manager";
export const PARALLEL_ROLES: AgentRole[] = ["writer", "artist", "researcher"];
export const ENGINEER_ROLE: AgentRole = "engineer";
export const ROLE_ORDER: AgentRole[] = [MANAGER_ROLE, ...PARALLEL_ROLES, ENGINEER_ROLE];
