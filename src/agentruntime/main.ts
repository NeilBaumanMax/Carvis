import { createMessageBus } from "../messagebus/index.js";
import { readPositiveIntEnv, waitForShutdown } from "../shared/process/lifecycle.js";
import { createAgentRuntime } from "./index.js";

const bus = createMessageBus();
const runtime = createAgentRuntime();
const heartbeatMs = readPositiveIntEnv(process.env, "CARVIS_HEARTBEAT_MS", 5_000);

console.log("[agentruntime] ready");
console.log(`[agentruntime] heartbeat every ${heartbeatMs}ms`);

await runtime.publishHeartbeat(bus);

const heartbeatTimer = setInterval(() => {
  void runtime.publishHeartbeat(bus);
}, heartbeatMs);

await waitForShutdown("agentruntime");

clearInterval(heartbeatTimer);
