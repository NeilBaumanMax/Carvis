export type RunPhase =
  | "created"
  | "manager_planning"
  | "parallel_roles_working"
  | "manager_reviewing"
  | "engineer_building"
  | "output_ready"
  | "retaining_agents"
  | "shutdown"
  | "failed";

export interface UserCommand {
  requestId: string;
  text: string;
  submittedAt: string;
}

export interface RunState {
  runId: string;
  requestId: string;
  phase: RunPhase;
  createdAt: string;
  updatedAt: string;
  speedMode?: "auto" | "fast" | "full";
}
