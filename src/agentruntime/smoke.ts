import { createMessageBus } from "../messagebus/index.js";
import type { CommandSubmittedPayload, RuntimeHeartbeatPayload } from "../shared/types/events.js";
import {
  createAgentPool,
  createHeartbeatTimer,
  createRuntimeBusClient,
  createTaskScheduler,
  defaultRuntimeConfig,
} from "./index.js";
import type { AgentRole } from "../shared/types/agent.js";

const config = defaultRuntimeConfig({ heartbeatIntervalMs: 50 });
const bus = createMessageBus();
const pool = createAgentPool(config);
const busClient = createRuntimeBusClient(bus, () => scheduler.getState().currentRunId);
const scheduler = createTaskScheduler(config, pool, busClient);

// --- Track heartbeat deliveries ---
const heartbeats: RuntimeHeartbeatPayload[] = [];

const heartbeatSub = bus.subscribe<RuntimeHeartbeatPayload>(
  { type: "runtime.heartbeat", target: "electron" },
  (event) => {
    heartbeats.push(event.payload);
  },
);

// --- Track commands ---
const commands: string[] = [];

const commandSub = bus.subscribe<CommandSubmittedPayload>(
  { type: "command.submitted", target: "agentruntime" },
  (event) => {
    commands.push(event.payload.commandText);
  },
);

// --- Start heartbeat ---
const timer = createHeartbeatTimer(config, pool, busClient);
timer.start(() => scheduler.getState().currentRunId);

// --- Test 1: submit a task ---
const task = scheduler.submitTask("build a demo project", "req-smoke-1");

assert(task.runId.length > 0, "task should have runId");
assert(task.commandText === "build a demo project", "task should store commandText");

const stateAfterSubmit = scheduler.getState();

assert(stateAfterSubmit.phase === "created", "initial phase should be created");
assert(stateAfterSubmit.queue.length === 1, "queue should have one task");
assert(stateAfterSubmit.pool.queueDepth === 1, "queueDepth should be 1");

// --- Test 2: advance through manager phase ---
const stateAfterManager = await scheduler.advance();

assert(stateAfterManager.phase === "manager_planning" || stateAfterManager.phase === "parallel_roles_working",
  `phase after manager advance should be manager_planning or parallel_roles_working, got ${stateAfterManager.phase}`);

const managerAgent = pool.getAgent("manager");
assert(managerAgent !== undefined, "manager agent should exist");
assert(
  managerAgent?.status === "retained" || managerAgent?.status === "done",
  `manager should be retained or done, got ${managerAgent?.status}`,
);

// --- Test 3: advance through parallel phase ---
// May need multiple advance calls
let currentState = stateAfterManager;
let maxAdvances = 10;

while (currentState.phase !== "shutdown" && maxAdvances > 0) {
  currentState = await scheduler.advance();
  maxAdvances -= 1;
}

assert(maxAdvances > 0, "scheduler should reach shutdown within advance limit");

// --- Test 4: verify all roles completed ---
const roles: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];

for (const role of roles) {
  const agent = pool.getAgent(role);
  assert(agent !== undefined, `${role} agent should exist`);
}

// --- Test 5: verify shutdown ---
const shutdownState = await scheduler.shutdown();

assert(shutdownState.phase === "shutdown", "final phase should be shutdown");
assert(shutdownState.queue.length === 0, "queue should be empty after shutdown");
assert(shutdownState.pool.queueDepth === 0, "queueDepth should be 0 after shutdown");

const finalSnapshot = pool.getSnapshot();
assert(finalSnapshot.activePidCount === 0, "active PID count should be 0 after shutdown");

// --- Wait for heartbeats to accumulate ---
await new Promise((resolve) => setTimeout(resolve, 100));

// --- Test 6: heartbeat was publishing ---
assert(heartbeats.length >= 1, "at least one heartbeat should have been published");

const lastHeartbeat = heartbeats[heartbeats.length - 1];
assert(lastHeartbeat !== undefined, "last heartbeat should exist");
assert(typeof lastHeartbeat.activePidCount === "number", "heartbeat should include activePidCount");
assert(typeof lastHeartbeat.idlePidCount === "number", "heartbeat should include idlePidCount");
assert(typeof lastHeartbeat.retainedPidCount === "number", "heartbeat should include retainedPidCount");
assert(typeof lastHeartbeat.queueDepth === "number", "heartbeat should include queueDepth");

// --- Cleanup ---
timer.stop();
heartbeatSub.unsubscribe();
commandSub.unsubscribe();

console.log("[agentruntime:smoke] ok");

// --- Helpers ---
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[agentruntime:smoke] FAIL: ${message}`);
  }
}
