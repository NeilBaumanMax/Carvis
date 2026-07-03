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
    "carvis-nas.service",
    "carvis.target",
  ],
);

const messagebus = mustUnit("carvis-messagebus.service");
const runtime = mustUnit("carvis-agentruntime.service");
const electron = mustUnit("carvis-electron.service");
const nas = mustUnit("carvis-nas.service");
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
assert(nas.includes("Description=Carvis NAS Remote Control"), "nas description should render");
assert(nas.includes("ExecStart=/home/howtion/carvis/nas/carvis-nas-server"), "nas ExecStart should render");
assert(
  nas.includes("Requires=carvis-messagebus.service carvis-agentruntime.service carvis-electron.service") &&
    nas.includes("After=carvis-messagebus.service carvis-agentruntime.service carvis-electron.service"),
  "nas should depend on electron API stack",
);
assert(
  target.includes("WantedBy=default.target") &&
    target.includes("Requires=carvis-messagebus.service carvis-agentruntime.service carvis-electron.service carvis-nas.service"),
  "target should require all services and install into default.target",
);

const withoutNasConfig = loadSetupConfig({
  CARVIS_NAS_ENABLED: "0",
});
const withoutNasUnits = createSystemdUserUnits(withoutNasConfig.components, {
  workingDirectory: "/home/howtion/carvis",
  nodePath: "/run/current-system/sw/bin/node",
  messagebusPort: 45931,
});

assert(
  !withoutNasUnits.some((unit) => unit.filename === "carvis-nas.service"),
  "nas unit should be disableable",
);

const browserConfig = loadSetupConfig({
  CARVIS_ELECTRON_BROWSER: "1",
  CARVIS_ELECTRON_BIN: "/nix/store/example-electron/bin/electron",
});
const browserUnits = createSystemdUserUnits(browserConfig.components, {
  workingDirectory: "/home/howtion/carvis",
  nodePath: "/run/current-system/sw/bin/node",
  messagebusPort: 45931,
});
const browserElectron = browserUnits.find((unit) => unit.filename === "carvis-electron.service")?.content ?? "";

assert(
  browserElectron.includes("ExecStart=/run/current-system/sw/bin/node dist/electron/runBrowserMain.js"),
  "browser electron unit should use BrowserWindow runner",
);
assert(
  browserElectron.includes("Environment=CARVIS_ELECTRON_BIN=/nix/store/example-electron/bin/electron"),
  "browser electron unit should include electron binary",
);

const providerConfig = loadSetupConfig({
  CARVIS_AGENTRUNTIME_ENV_FILE: "/home/howtion/.config/carvis/agentruntime.env",
  CARVIS_AGENTRUNTIME_REAL_PROVIDERS: "1",
});
const providerUnits = createSystemdUserUnits(providerConfig.components, {
  workingDirectory: "/home/howtion/carvis",
  nodePath: "/run/current-system/sw/bin/node",
  messagebusPort: 45931,
});
const providerRuntime = providerUnits.find((unit) => unit.filename === "carvis-agentruntime.service")?.content ?? "";

assert(
  providerRuntime.includes("EnvironmentFile=/home/howtion/.config/carvis/agentruntime.env"),
  "runtime unit should support local provider env file",
);
assert(
  providerRuntime.includes("Environment=CARVIS_AGENTRUNTIME_REAL_PROVIDERS=1"),
  "runtime unit should include real provider mode flag",
);

const nasConfig = loadSetupConfig({
  CARVIS_NAS_PUBLIC_URL: "http://192.168.137.59:8765",
  CARVIS_ELECTRON_API_URL: "http://127.0.0.1:45932",
  CARVIS_OUTPUT_ROOT: "/home/howtion/carvis/output/runs",
});
const nasUnits = createSystemdUserUnits(nasConfig.components, {
  workingDirectory: "/home/howtion/carvis",
  nodePath: "/run/current-system/sw/bin/node",
  messagebusPort: 45931,
});
const configuredNas = nasUnits.find((unit) => unit.filename === "carvis-nas.service")?.content ?? "";

assert(
  configuredNas.includes("Environment=CARVIS_NAS_PUBLIC_URL=http://192.168.137.59:8765") &&
    configuredNas.includes("Environment=CARVIS_ELECTRON_API_URL=http://127.0.0.1:45932") &&
    configuredNas.includes("Environment=CARVIS_OUTPUT_ROOT=/home/howtion/carvis/output/runs"),
  "nas unit should include remote control environment",
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
