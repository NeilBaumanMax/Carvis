import type { AgentRole, AgentStatus } from "./agent.js";
import type { RunPhase } from "./run.js";

export type CarvisEventSource = "setup" | "electron" | "messagebus" | "agentruntime" | "claudecode";

export type CarvisEventType =
  | "command.submitted"
  | "run.created"
  | "run.phase.changed"
  | "agent.starting"
  | "agent.ready"
  | "agent.output"
  | "agent.error"
  | "agent.done"
  | "agent.retained"
  | "agent.shutdown"
  | "runtime.heartbeat"
  | "output.ready";

export interface CarvisEventEnvelope<TPayload = unknown> {
  eventId: string;
  type: CarvisEventType;
  timestamp: string;
  source: CarvisEventSource;
  target?: CarvisEventSource;
  requestId?: string;
  runId?: string;
  agentId?: string;
  payload: TPayload;
}

export interface CommandSubmittedPayload {
  commandText: string;
}

export interface RuntimeHeartbeatPayload {
  activePidCount: number;
  idlePidCount: number;
  retainedPidCount: number;
  queueDepth: number;
}

export interface RunCreatedPayload {
  commandText: string;
  phase: RunPhase;
}

export interface RunPhaseChangedPayload {
  phase: RunPhase;
}

export interface AgentLifecyclePayload {
  role: AgentRole;
  status: AgentStatus;
  pid?: number;
  workplacePath: string;
}

export interface AgentOutputPayload {
  text: string;
  stream: "stdout" | "stderr" | "system";
}

export interface OutputReadyPayload {
  outputPath: string;
  manifestPath?: string;
}

export type CarvisEventPayloadByType = {
  "command.submitted": CommandSubmittedPayload;
  "run.created": RunCreatedPayload;
  "run.phase.changed": RunPhaseChangedPayload;
  "agent.starting": AgentLifecyclePayload;
  "agent.ready": AgentLifecyclePayload;
  "agent.output": AgentOutputPayload;
  "agent.error": AgentLifecyclePayload;
  "agent.done": AgentLifecyclePayload;
  "agent.retained": AgentLifecyclePayload;
  "agent.shutdown": AgentLifecyclePayload;
  "runtime.heartbeat": RuntimeHeartbeatPayload;
  "output.ready": OutputReadyPayload;
};

export type CarvisTypedEvent<TType extends CarvisEventType> = CarvisEventEnvelope<
  CarvisEventPayloadByType[TType]
> & {
  type: TType;
};
