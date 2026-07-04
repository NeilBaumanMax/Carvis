import type { MessageBus, MessageBusSubscription } from "../../messagebus/index.js";
import type {
  CommandSubmittedPayload,
  AgentOutputPayload,
  RuntimeHeartbeatPayload,
} from "../../shared/types/events.js";
import type { PoolSnapshot } from "../types.js";

export interface RuntimeBusClient {
  subscribeToCommands(handler: (commandText: string, requestId?: string) => void): MessageBusSubscription;
  publishHeartbeat(snapshot: PoolSnapshot, runId?: string): Promise<void>;
  publishAgentOutput(agentId: string, text: string, stream: "stdout" | "stderr" | "system"): Promise<void>;
  publishAgentEvent(
    type: string,
    agentId: string,
    runId?: string,
  ): Promise<void>;
}

export function createRuntimeBusClient(
  bus: MessageBus,
  runIdProvider: () => string | undefined,
): RuntimeBusClient {
  return {
    subscribeToCommands(handler) {
      return bus.subscribe<CommandSubmittedPayload>(
        {
          type: "command.submitted",
          target: "agentruntime",
        },
        (event) => {
          handler(event.payload.commandText, event.requestId);
        },
      );
    },

    async publishHeartbeat(snapshot) {
      await bus.publish<RuntimeHeartbeatPayload>({
        type: "runtime.heartbeat",
        source: "agentruntime",
        target: "electron",
        runId: runIdProvider(),
        payload: {
          activePidCount: snapshot.activePidCount,
          idlePidCount: snapshot.idlePidCount,
          retainedPidCount: snapshot.retainedPidCount,
          queueDepth: snapshot.queueDepth,
        },
      });
    },

    async publishAgentOutput(agentId, text, stream) {
      await bus.publish<AgentOutputPayload>({
        type: "agent.output",
        source: "agentruntime",
        target: "electron",
        runId: runIdProvider(),
        agentId,
        payload: {
          text,
          stream,
        },
      });
    },

    async publishAgentEvent(type, agentId, runId) {
      await bus.publish({
        type: type as "agent.starting" | "agent.ready" | "agent.done" | "agent.retained" | "agent.shutdown" | "agent.error",
        source: "agentruntime",
        target: "electron",
        runId: runId ?? runIdProvider(),
        agentId,
        payload: {},
      });
    },
  };
}
