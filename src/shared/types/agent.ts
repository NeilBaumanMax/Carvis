export type AgentRole = "manager" | "writer" | "artist" | "researcher" | "engineer";

export type AgentStatus =
  | "idle"
  | "starting"
  | "ready"
  | "assigned"
  | "working"
  | "waiting"
  | "done"
  | "retained"
  | "failed"
  | "shutdown";

export interface AgentIdentity {
  agentId: string;
  role: AgentRole;
  workplacePath: string;
}

export interface AgentRuntimeState extends AgentIdentity {
  pid?: number;
  status: AgentStatus;
  currentTaskId?: string;
  lastOutputAt?: string;
  lastHeartbeatAt?: string;
}
