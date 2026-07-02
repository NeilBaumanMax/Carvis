import { createMessageBus } from "../messagebus/index.js";
import type {
  AgentLifecyclePayload,
  CommandSubmittedPayload,
  OutputReadyPayload,
  RunPhaseChangedPayload,
  RuntimeHeartbeatPayload,
} from "../shared/types/events.js";
import { createAgentRuntime } from "./index.js";

const bus = createMessageBus();
const runtime = createAgentRuntime(bus);
const phases: string[] = [];
const starts: string[] = [];
const dones: string[] = [];
const shutdowns: string[] = [];
const retainedCounts: number[] = [];
const outputs: string[] = [];

bus.subscribe<RunPhaseChangedPayload>(
  {
    type: "run.phase.changed",
    target: "electron",
  },
  (event) => {
    phases.push(event.payload.phase);
  },
);

bus.subscribe<AgentLifecyclePayload>(
  {
    type: "agent.starting",
    target: "electron",
  },
  (event) => {
    starts.push(event.payload.role);
  },
);

bus.subscribe<AgentLifecyclePayload>(
  {
    type: "agent.done",
    target: "electron",
  },
  (event) => {
    dones.push(event.payload.role);
  },
);

bus.subscribe<AgentLifecyclePayload>(
  {
    type: "agent.shutdown",
    target: "electron",
  },
  (event) => {
    shutdowns.push(event.payload.role);
  },
);

bus.subscribe<RuntimeHeartbeatPayload>(
  {
    type: "runtime.heartbeat",
    target: "electron",
  },
  (event) => {
    retainedCounts.push(event.payload.retainedPidCount);
  },
);

bus.subscribe<OutputReadyPayload>(
  {
    type: "output.ready",
    target: "electron",
  },
  (event) => {
    outputs.push(event.payload.outputPath);
  },
);

runtime.start();

await bus.publish<CommandSubmittedPayload>({
  type: "command.submitted",
  source: "electron",
  target: "agentruntime",
  requestId: "req-runtime-smoke-1",
  payload: {
    commandText: "build an MVP smoke output",
  },
});

const snapshot = runtime.getSnapshot();

assertSequence(phases, [
  "manager_planning",
  "parallel_roles_working",
  "manager_reviewing",
  "engineer_building",
  "output_ready",
  "retaining_agents",
  "shutdown",
]);
assert(starts[0] === "manager", "manager should start first");
assert(starts.includes("writer"), "writer should start");
assert(starts.includes("artist"), "artist should start");
assert(starts.includes("researcher"), "researcher should start");
assert(starts.at(-1) === "engineer", "engineer should start after parallel roles");
assert(starts.filter((role) => role === "manager").length === 2, "manager should run planning and review");
assert(starts.lastIndexOf("manager") < starts.indexOf("engineer"), "manager review should run before engineer");
assert(dones.indexOf("engineer") > dones.indexOf("writer"), "engineer should finish after writer");
assert(dones.indexOf("engineer") > dones.indexOf("artist"), "engineer should finish after artist");
assert(dones.indexOf("engineer") > dones.indexOf("researcher"), "engineer should finish after researcher");
assert(dones.lastIndexOf("manager") < dones.indexOf("engineer"), "engineer should finish after manager review");
assertSequence(shutdowns, ["manager", "writer", "artist", "researcher", "engineer"]);
assert(retainedCounts.some((count) => count === 5), "all five agents should be retained before shutdown");
assertSequence(outputs, ["output/final-report.md"]);
assert(snapshot.queueDepth === 0, "queue should be empty after run");
assert(snapshot.retainedPidCount === 0, "retained PID count should be zero after shutdown");
assert(snapshot.agents.every((agent) => agent.status === "shutdown"), "all agents should be shutdown");

runtime.dispose();

const gateBus = createMessageBus();
const gateRuntime = createAgentRuntime(gateBus, {
  roleRunner: ({ run, agent }) => {
    if (run.phase === "manager_reviewing" && agent.role === "manager") {
      return {
        gatePassed: false,
      };
    }

    return undefined;
  },
});
const gateStarts: string[] = [];
const gatePhases: string[] = [];

gateBus.subscribe<RunPhaseChangedPayload>(
  {
    type: "run.phase.changed",
    target: "electron",
  },
  (event) => {
    gatePhases.push(event.payload.phase);
  },
);
gateBus.subscribe<AgentLifecyclePayload>(
  {
    type: "agent.starting",
    target: "electron",
  },
  (event) => {
    gateStarts.push(event.payload.role);
  },
);

gateRuntime.start();
await gateBus.publish<CommandSubmittedPayload>({
  type: "command.submitted",
  source: "electron",
  target: "agentruntime",
  requestId: "req-runtime-smoke-review-fail",
  payload: {
    commandText: "block engineer when manager review fails",
  },
});

assert(gatePhases.includes("manager_reviewing"), "manager review phase should run before gate decision");
assert(!gatePhases.includes("engineer_building"), "engineer phase should be skipped when manager review fails");
assert(!gateStarts.includes("engineer"), "engineer should not start when manager review fails");

gateRuntime.dispose();

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
