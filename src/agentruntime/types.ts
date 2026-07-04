import type { AgentRuntimeState } from "../shared/types/agent.js";
import type { RunState, UserCommand } from "../shared/types/run.js";

export interface AgentRuntimeSnapshot {
  run?: RunState;
  commandQueue: UserCommand[];
  agents: AgentRuntimeState[];
}

export interface MockRunResult {
  runId: string;
  roleFlow: string[];
  outputPath: string;
}
