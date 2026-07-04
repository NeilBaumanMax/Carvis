import { createMessageBus } from "../messagebus/index.js";
import type { OutputReadyPayload, RuntimeHeartbeatPayload } from "../shared/types/events.js";
import {
  createAgentPool,
  createHeartbeatTimer,
  createRuntimeBusClient,
  createTaskScheduler,
  defaultRuntimeConfig,
} from "../agentruntime/index.js";
import type { AgentRole } from "../shared/types/agent.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm, readFile, access } from "node:fs/promises";

const testRoot = join(tmpdir(), "carvis-e2e-" + Date.now());
const workplaceRoot = join(testRoot, "workplaces");
const outputRoot = join(testRoot, "output");

console.log(`[e2e] test root: ${testRoot}`);

const config = defaultRuntimeConfig({
  heartbeatIntervalMs: 100,
  workplaceRoot,
  outputDir: outputRoot,
});

const bus = createMessageBus();
const pool = createAgentPool(config);
const busClient = createRuntimeBusClient(bus, () => scheduler.getState().currentRunId);
const scheduler = createTaskScheduler(config, pool, busClient);

// --- Collect output.ready events ---
const outputReadyEvents: OutputReadyPayload[] = [];

bus.subscribe<OutputReadyPayload>(
  { type: "output.ready", target: "electron" },
  (event) => {
    outputReadyEvents.push(event.payload);
  },
);

// --- Collect phase transitions ---
const seenPhases: string[] = [];

// --- Heartbeat tracking ---
const heartbeats: RuntimeHeartbeatPayload[] = [];
bus.subscribe<RuntimeHeartbeatPayload>(
  { type: "runtime.heartbeat", target: "electron" },
  (event) => {
    heartbeats.push(event.payload);
  },
);

const timer = createHeartbeatTimer(config, pool, busClient);
timer.start(() => scheduler.getState().currentRunId);

let allOk = true;

try {
  // --- Step 1: Submit task ---
  const task = scheduler.submitTask("build a demo project");
  assert(task.runId.length > 0, "task should have runId");
  assert(scheduler.getState().phase === "created", "phase should be created");
  console.log("ok 1 - task submitted, phase=created");

  // --- Step 2: Advance through all phases ---
  let state = scheduler.getState();
  let maxAdvances = 20;

  while (state.phase !== "shutdown" && maxAdvances > 0) {
    const prevPhase = state.phase;
    state = await scheduler.advance();
    if (state.phase !== prevPhase) {
      seenPhases.push(state.phase);
    }
    maxAdvances -= 1;
  }

  assert(maxAdvances > 0, "scheduler should reach shutdown within limit");
  console.log(`ok 2 - reached shutdown in ${20 - maxAdvances} advances, phases: ${seenPhases.join(" → ")}`);

  // --- Step 3: Verify core phases traversed ---
  // manager_planning is transient (set+execute+transition in one advance call),
  // so it may not be observable. The other 4 phases must be seen.
  const requiredObserved = [
    "parallel_roles_working",
    "engineer_building",
    "output_ready",
    "retaining_agents",
  ];
  for (const p of requiredObserved) {
    assert(seenPhases.includes(p), `should pass through phase: ${p}`);
  }
  console.log(`ok 3 - core phases traversed: ${seenPhases.join(" → ")}`);

  // --- Step 4: Verify all 5 roles existed ---
  const roles: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];
  for (const role of roles) {
    const agent = pool.getAgent(role);
    assert(agent !== undefined, `${role} agent should exist`);
  }
  console.log("ok 4 - all 5 role agents created");

  // --- Step 5: Verify output.ready event fired ---
  assert(outputReadyEvents.length >= 1, "at least one output.ready event should fire");
  const readyEvent = outputReadyEvents[0];
  assert(readyEvent.outputPath === outputRoot, "outputPath should match config");
  assert(readyEvent.manifestPath !== undefined, "manifestPath should be present");
  console.log(`ok 5 - output.ready fired: path=${readyEvent.outputPath}`);

  // --- Step 6: Verify output files exist ---
  const manifestPath = join(outputRoot, "manifest.json");
  const reportPath = join(outputRoot, "report.md");

  await access(manifestPath);
  await access(reportPath);

  const manifestRaw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw);
  assert(typeof manifest.runId === "string", "manifest should have runId");
  assert(manifest.roles.manager !== undefined, "manifest should have manager role");
  assert(manifest.roles.engineer !== undefined, "manifest should have engineer role");

  const reportRaw = await readFile(reportPath, "utf-8");
  assert(reportRaw.includes("## manager"), "report should mention manager");
  assert(reportRaw.includes("## engineer"), "report should mention engineer");
  assert(reportRaw.includes(task.runId), "report should include runId");
  console.log("ok 6 - manifest.json + report.md verified");

  // --- Step 7: Shutdown and verify cleanup ---
  const shutdownState = await scheduler.shutdown();
  assert(shutdownState.phase === "shutdown", "final phase should be shutdown");
  assert(shutdownState.queue.length === 0, "queue should be empty");
  assert(shutdownState.pool.queueDepth === 0, "queueDepth should be 0");

  const snapshot = pool.getSnapshot();
  assert(snapshot.activePidCount === 0, "active PID count should be 0");
  assert(snapshot.idlePidCount === 0, "idle PID count should be 0");
  console.log("ok 7 - shutdown clean: queue=0, active=0, idle=0");

  // --- Step 8: Heartbeat was publishing ---
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(heartbeats.length >= 1, "at least one heartbeat should have been published");
  const lastHb = heartbeats[heartbeats.length - 1];
  assert(typeof lastHb.queueDepth === "number", "heartbeat should include queueDepth");
  console.log(`ok 8 - heartbeat published (${heartbeats.length} total)`);

} catch (err) {
  console.error(`[e2e] FAIL: ${err instanceof Error ? err.message : err}`);
  allOk = false;
  process.exitCode = 1;
} finally {
  timer.stop();
  await rm(testRoot, { recursive: true, force: true });
}

if (allOk) {
  console.log("\n[e2e] e2e:smoke PASSED");
  process.exit(0);
} else {
  process.exit(1);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[e2e] FAIL: ${message}`);
  }
}
