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
