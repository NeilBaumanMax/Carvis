import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMessageBus } from "../messagebus/index.js";
import type { OutputReadyPayload, RuntimeHeartbeatPayload } from "../shared/types/events.js";
import { AGENT_RUNTIME_ROLES, createAgentRuntime } from "./index.js";

const bus = createMessageBus();
const workspaceRoot = await mkdtemp(join(tmpdir(), "carvis-runtime-workplaces-"));
const outputRoot = await mkdtemp(join(tmpdir(), "carvis-runtime-output-"));
const runtime = createAgentRuntime(workspaceRoot, outputRoot);
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

try {
  const initialSnapshot = runtime.getSnapshot();
  assertSequence(
    initialSnapshot.agents.map((agent) => agent.role),
    [...AGENT_RUNTIME_ROLES],
  );
  assert(initialSnapshot.agents.every((agent) => agent.status === "idle"), "agents should start idle");

  await runtime.publishHeartbeat(bus);
  assert(heartbeats[0]?.idlePidCount === 5, "initial heartbeat should report five idle agents");

  const runResult = await runtime.runCommand(bus, "build local full-run smoke", {
    ...process.env,
    CARVIS_CLAUDE_MODE: process.env.CARVIS_CLAUDE_MODE ?? "mock",
  });
  const retainedSnapshot = runtime.getSnapshot();

  assert(runResult.roleFlow[0] === "manager:working", "manager should work first");
  assert(runResult.roleFlow.includes("engineer:working"), "engineer should run after parallel roles");
  assert(runResult.outputPath.endsWith("final-report.md"), "output path should point to final report");
  assertSequence(outputPaths, [runResult.outputPath]);
  assert(
    retainedSnapshot.agents.every((agent) => agent.status === "retained"),
    "agents should be retained after run",
  );

  const report = await readFile(runResult.outputPath, "utf8");
  assert(report.includes("Carvis Final Report"), "runtime should write final report");

  await runtime.publishHeartbeat(bus);
  assert(heartbeats.at(-1)?.retainedPidCount === 5, "final heartbeat should report five retained agents");

  console.log("[agentruntime:smoke] ok");
} finally {
  await rm(workspaceRoot, { recursive: true, force: true });
  await rm(outputRoot, { recursive: true, force: true });
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
