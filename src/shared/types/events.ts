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
  "run.created": unknown;
  "run.phase.changed": unknown;
  "agent.starting": unknown;
  "agent.ready": unknown;
  "agent.output": AgentOutputPayload;
  "agent.error": unknown;
  "agent.done": unknown;
  "agent.retained": unknown;
  "agent.shutdown": unknown;
  "runtime.heartbeat": RuntimeHeartbeatPayload;
  "output.ready": OutputReadyPayload;
};

export type CarvisTypedEvent<TType extends CarvisEventType> = CarvisEventEnvelope<
  CarvisEventPayloadByType[TType]
> & {
  type: TType;
};
