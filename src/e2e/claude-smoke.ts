import { createMessageBus } from "../messagebus/index.js";
import type { OutputReadyPayload } from "../shared/types/events.js";
import {
  createAgentPool,
  createHeartbeatTimer,
  createRuntimeBusClient,
  createTaskScheduler,
  defaultRuntimeConfig,
  isClaudeCodeAvailable,
} from "../agentruntime/index.js";
import type { AgentRole } from "../shared/types/agent.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm, readFile, access } from "node:fs/promises";

if (!isClaudeCodeAvailable()) {
  console.log("[e2e:claude] SKIP: Claude Code CLI not available (no ANTHROPIC_AUTH_TOKEN)");
  process.exit(0);
}

const testRoot = join(tmpdir(), "carvis-e2e-claude-" + Date.now());
const workplaceRoot = join(testRoot, "workplaces");
const outputRoot = join(testRoot, "output");

console.log(`[e2e:claude] test root: ${testRoot}`);

const config = defaultRuntimeConfig({
  heartbeatIntervalMs: 100,
  workplaceRoot,
  outputDir: outputRoot,
  executionMode: "claude",
  claudeTimeoutMs: 120_000,
});

const bus = createMessageBus();
const pool = createAgentPool(config);
const busClient = createRuntimeBusClient(bus, () => scheduler.getState().currentRunId);
const scheduler = createTaskScheduler(config, pool, busClient);

let allOk = true;

try {
  const task = scheduler.submitTask("write a hello world in python");
  assert(scheduler.getState().phase === "created", "phase should be created");
  console.log("ok 1 - task submitted, phase=created");

  const outputReadyEvents: OutputReadyPayload[] = [];
  bus.subscribe<OutputReadyPayload>(
    { type: "output.ready", target: "electron" },
    (event) => { outputReadyEvents.push(event.payload); },
  );

  let state = scheduler.getState();
  let maxAdvances = 20;

  while (state.phase !== "shutdown" && maxAdvances > 0) {
    state = await scheduler.advance();
    maxAdvances -= 1;
  }

  assert(state.phase === "shutdown", "should reach shutdown");
  console.log(`ok 2 - reached shutdown`);

  // Verify all roles completed
  const roles: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];
  for (const role of roles) {
    const agent = pool.getAgent(role);
    assert(agent !== undefined, `${role} agent should exist`);
  }
  console.log("ok 3 - all 5 roles created");

  // Check if claude produced results (result.md files exist)
  let resultCount = 0;
  for (const role of roles) {
    const resultPath = join(workplaceRoot, role, "result.md");
    try {
      await access(resultPath);
      resultCount++;
    } catch {}
  }
  assert(resultCount >= 1, `at least one result.md should exist, got ${resultCount}`);
  console.log(`ok 4 - ${resultCount}/5 result.md files produced`);

  // Verify output
  assert(outputReadyEvents.length >= 1, "output.ready should fire");
  const manifestPath = join(outputRoot, "manifest.json");
  await access(manifestPath);
  const manifestRaw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw);
  assert(typeof manifest.runId === "string", "manifest should have runId");
  console.log("ok 5 - manifest.json valid");

  // Shutdown
  await scheduler.shutdown();
  const snapshot = pool.getSnapshot();
  assert(snapshot.activePidCount === 0, "all agents shutdown");
  console.log("ok 6 - clean shutdown");

} catch (err) {
  console.error(`[e2e:claude] FAIL: ${err instanceof Error ? err.message : err}`);
  allOk = false;
  process.exitCode = 1;
} finally {
  await rm(testRoot, { recursive: true, force: true });
}

if (allOk) {
  console.log("\n[e2e:claude] PASSED");
  process.exit(0);
} else {
  process.exit(1);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[e2e:claude] FAIL: ${message}`);
  }
}
