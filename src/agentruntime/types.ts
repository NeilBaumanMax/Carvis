import type { AgentRole, AgentRuntimeState, AgentStatus } from "../shared/types/agent.js";
import type { RunPhase } from "../shared/types/run.js";

export type ExecutionMode = "mock" | "claude";

export interface RuntimeConfig {
  heartbeatIntervalMs: number;
  poolSize: number;
  workplaceRoot: string;
  outputDir: string;
  shutdownTimeoutMs: number;
  executionMode: ExecutionMode;
  claudeTimeoutMs: number;
}

export interface TaskItem {
  runId: string;
  requestId?: string;
  commandText: string;
  createdAt: string;
}

export interface PoolSnapshot {
  activePidCount: number;
  idlePidCount: number;
  retainedPidCount: number;
  queueDepth: number;
  agents: AgentRuntimeState[];
}

export interface SchedulerState {
  currentRunId?: string;
  phase: RunPhase;
  queue: TaskItem[];
  pool: PoolSnapshot;
  startedAt?: string;
  updatedAt: string;
}

export type RoleFlowStep =
  | { kind: "sequential"; role: AgentRole }
  | { kind: "parallel"; roles: AgentRole[] };

export const ROLE_FLOW: readonly RoleFlowStep[] = [
  { kind: "sequential", role: "manager" },
  { kind: "parallel", roles: ["writer", "artist", "researcher"] },
  { kind: "sequential", role: "engineer" },
];

export function roleTitle(role: AgentRole): string {
  switch (role) {
    case "manager":
      return "Manager";
    case "writer":
      return "Writer";
    case "artist":
      return "Artist";
    case "researcher":
      return "Researcher";
    case "engineer":
      return "Engineer";
  }
}

export function defaultRuntimeConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    heartbeatIntervalMs: overrides?.heartbeatIntervalMs ?? 1_000,
    poolSize: overrides?.poolSize ?? 5,
    workplaceRoot: overrides?.workplaceRoot ?? "workplaces",
    outputDir: overrides?.outputDir ?? "output",
    shutdownTimeoutMs: overrides?.shutdownTimeoutMs ?? 5_000,
    executionMode: overrides?.executionMode ?? "mock",
    claudeTimeoutMs: overrides?.claudeTimeoutMs ?? 120_000,
  };
}

export function isValidStatusTransition(
  current: AgentStatus,
  next: AgentStatus,
): boolean {
  const allowed: Record<AgentStatus, readonly AgentStatus[]> = {
    idle: ["starting"],
    starting: ["ready", "failed"],
    ready: ["assigned"],
    assigned: ["working"],
    working: ["waiting", "done", "failed"],
    waiting: ["working", "done", "failed"],
    done: ["retained", "failed"],
    retained: ["shutdown"],
    failed: ["shutdown"],
    shutdown: [],
  };

  return (allowed[current] ?? []).includes(next);
}
