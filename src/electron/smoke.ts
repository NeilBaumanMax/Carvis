import { createMessageBus } from "../messagebus/index.js";
import type {
  AgentLifecyclePayload,
  CommandSubmittedPayload,
  OutputReadyPayload,
  RuntimeHeartbeatPayload,
} from "../shared/types/events.js";
import { createElectronShell } from "./index.js";

const bus = createMessageBus();
const shell = createElectronShell(bus);
const commands: string[] = [];

bus.subscribe<CommandSubmittedPayload>(
  {
    type: "command.submitted",
    target: "agentruntime",
  },
  (event) => {
    commands.push(event.payload.commandText);
    assert(event.source === "electron", "command should originate from electron");
    assert(event.requestId === "req-electron-smoke-1", "command should keep requestId");
  },
);

const initialState = shell.getState();
assertSequence(
  initialState.panels.map((panel) => panel.role),
  ["manager", "writer", "artist", "researcher", "engineer"],
);
assert(initialState.runtime.queueDepth === 0, "initial queue depth should be zero");

await shell.submitCommand("  build a launch report  ", {
  requestId: "req-electron-smoke-1",
});

assertSequence(commands, ["build a launch report"]);

await bus.publish<RuntimeHeartbeatPayload>({
  type: "runtime.heartbeat",
  source: "agentruntime",
  target: "electron",
  runId: "run-electron-smoke-1",
  payload: {
    activePidCount: 2,
    idlePidCount: 1,
    retainedPidCount: 3,
    queueDepth: 4,
  },
});

await bus.publish<OutputReadyPayload>({
  type: "output.ready",
  source: "agentruntime",
  target: "electron",
  runId: "run-electron-smoke-1",
  payload: {
    outputPath: "output/final-report.md",
    manifestPath: "output/manifest.json",
  },
});

await bus.publish<AgentLifecyclePayload>({
  type: "agent.ready",
  source: "agentruntime",
  target: "electron",
  runId: "run-electron-smoke-1",
  agentId: "manager",
  payload: {
    role: "manager",
    status: "ready",
    pid: 41001,
    workplacePath: "workplaces/manager",
  },
});

const updatedState = shell.getState();
const managerPanel = updatedState.panels.find((panel) => panel.role === "manager");
assert(updatedState.submittedCommands[0] === "build a launch report", "shell should remember command");
assert(updatedState.runtime.activePidCount === 2, "heartbeat active PID count should update");
assert(updatedState.runtime.idlePidCount === 1, "heartbeat idle PID count should update");
assert(updatedState.runtime.retainedPidCount === 3, "heartbeat retained PID count should update");
assert(updatedState.runtime.queueDepth === 4, "heartbeat queue depth should update");
assert(updatedState.runtime.lastHeartbeatAt !== undefined, "heartbeat timestamp should be displayed");
assert(updatedState.outputs.length === 1, "output ready should create one output entry");
assert(updatedState.outputs[0]?.outputPath === "output/final-report.md", "output path should be displayed");
assert(
  updatedState.outputs[0]?.manifestPath === "output/manifest.json",
  "manifest path should be displayed",
);
assert(managerPanel?.status === "ready", "manager panel status should update");
assert(managerPanel?.pid === 41001, "manager panel PID should update");

shell.dispose();

console.log("[electron:smoke] ok");

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
