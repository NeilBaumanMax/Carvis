import { loadSetupConfig, runSetupSupervisor } from "./index.js";

const smokePort = String(48_000 + Math.floor(Math.random() * 1_000));
const baseConfig = loadSetupConfig({
  CARVIS_SETUP_MODE: "spawn",
  CARVIS_NAS_ENABLED: "0",
});
const config = {
  ...baseConfig,
  components: baseConfig.components.map((component) => ({
    ...component,
    environment: {
      ...component.environment,
      CARVIS_MESSAGEBUS_PORT: smokePort,
    },
  })),
};

const result = await runSetupSupervisor({
  ...config,
  startupTimeoutMs: 5_000,
});

try {
  assert(result.ok, "spawn setup should succeed");
  assertSequence(result.started, ["messagebus", "agentruntime", "electron"]);
  assert(result.processes.every((process) => process.pid !== undefined), "all components should have pids");
} finally {
  for (const process of result.processes) {
    if (process.pid !== undefined) {
      try {
        globalThis.process.kill(process.pid, "SIGTERM");
      } catch {
        // Process may already have exited after the spawn event.
      }
    }
  }
}

console.log("[setup:spawn-smoke] ok");

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
