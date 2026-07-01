import { loadSetupConfig, runSetupSupervisor } from "./index.js";
import type { ComponentStarter, SetupComponentName } from "./types.js";

const config = loadSetupConfig({
  CARVIS_SETUP_MODE: "plan",
});

const successfulRun = await runSetupSupervisor(config, async () => ({}));
assert(successfulRun.ok, "setup should succeed when all components start");
assertSequence(successfulRun.started, ["messagebus", "agentruntime", "electron"]);

const failingStarter: ComponentStarter = async (component) => {
  if (component.name === "agentruntime") {
    throw new Error("simulated agentruntime failure");
  }

  return {};
};

const failedRun = await runSetupSupervisor(config, failingStarter);
assert(!failedRun.ok, "setup should fail when a required component fails");
assert(failedRun.failed === "agentruntime", "failed component should be agentruntime");
assertSequence(failedRun.started, ["messagebus"]);
assert(
  failedRun.events.some((event) => event.type === "setup.failed"),
  "failed run should include setup.failed event",
);

console.log("[setup:smoke] ok");

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
