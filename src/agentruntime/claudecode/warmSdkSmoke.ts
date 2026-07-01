import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { ClaudeCodeWarmSdkAgent } from "./warmSdk.js";

const env = process.env;

if (env.CARVIS_CLAUDECODE_SDK_REAL_SMOKE !== "1") {
  console.log("[claudecode:sdk-smoke] ok (dry)");
  process.exit(0);
}

assert(
  Boolean(env.ANTHROPIC_AUTH_TOKEN ?? env.DEEPSEEK_API_KEY),
  "real SDK smoke requires ANTHROPIC_AUTH_TOKEN or DEEPSEEK_API_KEY",
);

const smokeRoot = await mkdtemp(join(process.cwd(), ".carvis-claudecode-sdk-"));
const expected = "carvis claude sdk warm ok";
const agent = new ClaudeCodeWarmSdkAgent({
  env,
  cwd: smokeRoot,
  model: env.CARVIS_CLAUDECODE_SMOKE_MODEL ?? "deepseek-v4-flash",
  maxBudgetUsd: env.CARVIS_CLAUDECODE_SMOKE_MAX_BUDGET_USD ?? "0.20",
  timeoutMs: Number(env.CARVIS_CLAUDECODE_SMOKE_TIMEOUT_MS ?? 180_000),
});

try {
  await agent.warmup();
  assert(agent.retained, "SDK warm agent should be retained before query");
  assert(agent.pid !== undefined && agent.pid > 0, "SDK warm agent should expose spawned process pid");

  const firstPid = agent.pid;
  const result = await agent.query(`Reply exactly: ${expected}`);

  assert(result.output === expected, `expected ${expected}, got ${result.output}`);
  assert(result.spawn?.pid === firstPid, "query should use the pre-warmed process");
  assert(agent.retained, "SDK warm agent should re-warm after query");
  assert(agent.pid !== undefined && agent.pid > 0, "SDK warm agent should expose next warm pid");

  console.log("[claudecode:sdk-smoke] ok (real)");
} finally {
  agent.close();

  if (env.CARVIS_KEEP_CLAUDECODE_SDK_ARTIFACTS === "1") {
    console.log(`[claudecode:sdk-smoke] artifacts kept at ${smokeRoot}`);
  } else {
    await rm(smokeRoot, { recursive: true, force: true });
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
