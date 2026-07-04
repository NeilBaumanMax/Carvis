import { createMessageBus } from "../messagebus/index.js";
import type { OutputReadyPayload, RuntimeHeartbeatPayload } from "../shared/types/events.js";
import { AGENT_RUNTIME_ROLES, createAgentRuntime } from "./index.js";

const bus = createMessageBus();
const runtime = createAgentRuntime();
const heartbeats: RuntimeHeartbeatPayload[] = [];
const outputPaths: string[] = [];

bus.subscribe<RuntimeHeartbeatPayload>(
  {
    type: "runtime.heartbeat",
    target: "electron",
  },
  (event) => {
    heartbeats.push(event.payload);
  },
);

bus.subscribe<OutputReadyPayload>(
  {
    type: "output.ready",
    target: "electron",
  },
  (event) => {
    outputPaths.push(event.payload.outputPath);
  },
);

const initialSnapshot = runtime.getSnapshot();
assertSequence(
  initialSnapshot.agents.map((agent) => agent.role),
  [...AGENT_RUNTIME_ROLES],
);
assert(initialSnapshot.agents.every((agent) => agent.status === "idle"), "agents should start idle");

await runtime.publishHeartbeat(bus);
assert(heartbeats[0]?.idlePidCount === 5, "initial heartbeat should report five idle agents");

const runResult = await runtime.runMockCommand(bus, "build local full-run smoke");
const retainedSnapshot = runtime.getSnapshot();

assert(runResult.roleFlow[0] === "manager:working", "manager should work first");
assert(runResult.roleFlow.includes("engineer:working"), "engineer should run after parallel roles");
assert(runResult.outputPath === "output/final-report.md", "mock output path should be stable");
assertSequence(outputPaths, ["output/final-report.md"]);
assert(
  retainedSnapshot.agents.every((agent) => agent.status === "retained"),
  "agents should be retained after mock run",
);

await runtime.publishHeartbeat(bus);
assert(heartbeats.at(-1)?.retainedPidCount === 5, "final heartbeat should report five retained agents");

console.log("[agentruntime:smoke] ok");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSequence<T>(actual: readonly T[], expected: readonly T[]): void {
  assert(actual.length === expected.length, `expected ${expected.length} values, got ${actual.length}`);

  for (const [index, expectedValue] of expected.entries()) {
    assert(
      actual[index] === expectedValue,
      `expected value ${index} to be ${String(expectedValue)}, got ${String(actual[index])}`,
    );
  }
}
