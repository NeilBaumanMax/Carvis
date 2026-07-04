import { loadSetupConfig, runSetupSupervisor, shutdownStartedProcesses } from "./index.js";
import type { SetupComponentName } from "./types.js";

const config = loadSetupConfig({
  ...process.env,
  CARVIS_SETUP_MODE: "spawn",
  CARVIS_SETUP_TIMEOUT_MS: "5000",
});

const result = await runSetupSupervisor(config);

try {
  assert(result.ok, "full startup should succeed");
  assertSequence(result.started, ["messagebus", "agentruntime", "electron"]);
  assert(result.startedProcesses.length === 3, "full startup should retain three child processes");
} finally {
  await shutdownStartedProcesses(result);
}

console.log("[start:full:smoke] ok");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSequence(
  actual: readonly SetupComponentName[],
  expected: readonly SetupComponentName[],
): void {
  assert(
    actual.length === expected.length,
    `expected ${expected.length} started components, got ${actual.length}`,
  );

  for (const [index, expectedName] of expected.entries()) {
    assert(
      actual[index] === expectedName,
      `expected component ${index} to be ${expectedName}, got ${actual[index]}`,
    );
  }
}
