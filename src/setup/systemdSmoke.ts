import { loadSetupConfig } from "./config.js";
import { createSystemdUserUnits } from "./systemd.js";

const config = loadSetupConfig({});
const units = createSystemdUserUnits(config.components, {
  workingDirectory: "/home/howtion/carvis",
  nodePath: "/run/current-system/sw/bin/node",
  messagebusPort: 45931,
});
const byName = new Map(units.map((unit) => [unit.filename, unit.content]));

assertSequence(
  units.map((unit) => unit.filename),
  [
    "carvis-messagebus.service",
    "carvis-agentruntime.service",
    "carvis-electron.service",
    "carvis.target",
  ],
);

const messagebus = mustUnit("carvis-messagebus.service");
const runtime = mustUnit("carvis-agentruntime.service");
const electron = mustUnit("carvis-electron.service");
const target = mustUnit("carvis.target");

assert(messagebus.includes("Description=Carvis Message Bus"), "messagebus description should render");
assert(
  messagebus.includes("ExecStart=/run/current-system/sw/bin/node dist/messagebus/main.js"),
  "messagebus ExecStart should render",
);
assert(
  runtime.includes("Requires=carvis-messagebus.service") &&
    runtime.includes("After=carvis-messagebus.service"),
  "runtime should depend on messagebus",
);
assert(
  electron.includes("Requires=carvis-messagebus.service carvis-agentruntime.service") &&
    electron.includes("After=carvis-messagebus.service carvis-agentruntime.service"),
  "electron should depend on messagebus and runtime",
);
assert(
  electron.includes("Environment=CARVIS_MESSAGEBUS_PORT=45931"),
  "component units should include messagebus port",
);
assert(
  electron.includes("WorkingDirectory=/home/howtion/carvis"),
  "component units should include working directory",
);
assert(
  target.includes("WantedBy=default.target") &&
    target.includes("Requires=carvis-messagebus.service carvis-agentruntime.service carvis-electron.service"),
  "target should require all services and install into default.target",
);

console.log("[setup:systemd-smoke] ok");

function mustUnit(filename: string): string {
  const content = byName.get(filename);

  assert(content !== undefined, `${filename} should exist`);
  return content;
}

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
