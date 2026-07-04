export { createAgentPool } from "./pool.js";
export type { AgentPool } from "./pool.js";
export { createTaskScheduler } from "./scheduler.js";
export type { TaskScheduler } from "./scheduler.js";
export { createHeartbeatTimer } from "./heartbeat.js";
export type { HeartbeatTimer } from "./heartbeat.js";
export { createRuntimeBusClient } from "./messagebus/client.js";
export type { RuntimeBusClient } from "./messagebus/client.js";
export {
  defaultRuntimeConfig,
  ROLE_FLOW,
  isValidStatusTransition,
  roleTitle,
} from "./types.js";
export type {
  PoolSnapshot,
  RoleFlowStep,
  RuntimeConfig,
  SchedulerState,
  TaskItem,
} from "./types.js";

// Claude Code CLI adapter
export {
  createDeepSeekClaudeCodeEnv,
  mergeClaudeCodeEnv,
  spawnClaudeCode,
  isClaudeCodeAvailable,
  createClaudeCodeAgent,
  defaultRolePrompts,
  createAgentManager,
} from "./claudecode/index.js";
export type {
  DeepSeekClaudeCodeEnv,
  ClaudeCodeProcess,
  SpawnConfig,
  ClaudeCodeAgent,
  ClaudeCodeAgentConfig,
  RolePrompt,
  AgentManager,
} from "./claudecode/index.js";
