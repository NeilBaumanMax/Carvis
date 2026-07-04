import type { AgentPool } from "./pool.js";
import type { RuntimeBusClient } from "./messagebus/client.js";
import type { RuntimeConfig } from "./types.js";

export interface HeartbeatTimer {
  start(runIdProvider: () => string | undefined): void;
  stop(): void;
  get tickCount(): number;
}

export function createHeartbeatTimer(
  config: RuntimeConfig,
  pool: AgentPool,
  busClient: RuntimeBusClient,
): HeartbeatTimer {
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let _tickCount = 0;

  return {
    start(runIdProvider) {
      if (intervalId !== undefined) {
        return;
      }

      intervalId = setInterval(() => {
        const snapshot = pool.getSnapshot();
        _tickCount += 1;

        busClient.publishHeartbeat(snapshot, runIdProvider()).catch(() => {
          // heartbeat publish failure is non-fatal; log and continue
        });
      }, config.heartbeatIntervalMs);
    },

    stop() {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },

    get tickCount() {
      return _tickCount;
    },
  };
}
