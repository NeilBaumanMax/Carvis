import { createMessageBus } from "./index.js";
import type {
  CommandSubmittedPayload,
  RuntimeHeartbeatPayload,
} from "../shared/types/events.js";

const bus = createMessageBus();

const commands: string[] = [];
const heartbeatQueueDepths: number[] = [];

bus.subscribe<CommandSubmittedPayload>(
  {
    type: "command.submitted",
    target: "agentruntime",
  },
  (event) => {
    commands.push(event.payload.commandText);
    assert(event.source === "electron", "command should originate from electron");
    assert(event.requestId === "req-smoke-1", "command should keep requestId");
    assert(event.eventId.length > 0, "command should have eventId");
    assert(!Number.isNaN(Date.parse(event.timestamp)), "command should have ISO timestamp");
  },
);

bus.subscribe<RuntimeHeartbeatPayload>(
  {
    type: "runtime.heartbeat",
    target: "electron",
  },
  (event) => {
    heartbeatQueueDepths.push(event.payload.queueDepth);
    assert(event.source === "agentruntime", "heartbeat should originate from agentruntime");
    assert(event.runId === "run-smoke-1", "heartbeat should keep runId");
  },
);

const commandResult = await bus.publish<CommandSubmittedPayload>({
  type: "command.submitted",
  source: "electron",
  target: "agentruntime",
  requestId: "req-smoke-1",
  payload: {
    commandText: "build a smoke-test output",
  },
});

assert(commandResult.delivered === 1, "command should be delivered to one runtime subscriber");
assertSequence(commands, ["build a smoke-test output"]);

const heartbeatResult = await bus.publish<RuntimeHeartbeatPayload>({
  type: "runtime.heartbeat",
  source: "agentruntime",
  target: "electron",
  runId: "run-smoke-1",
  payload: {
    activePidCount: 1,
    idlePidCount: 0,
    retainedPidCount: 0,
    queueDepth: 2,
  },
});

assert(heartbeatResult.delivered === 1, "heartbeat should be delivered to one electron subscriber");
assertSequence(heartbeatQueueDepths, [2]);

const disconnectedResult = await bus.publish({
  type: "output.ready",
  source: "agentruntime",
  target: "electron",
  runId: "run-smoke-1",
  payload: {
    outputPath: "output/final-report.md",
  },
});

assert(disconnectedResult.delivered === 0, "unsubscribed event should report zero deliveries");

console.log("[messagebus:smoke] ok");

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
