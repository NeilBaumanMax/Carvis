import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { createAgentRuntime } from "../agentruntime/index.js";
import {
  createClaudeCodeRoleRunner,
  createClaudeCodeWarmSdkRoleRunner,
} from "../agentruntime/claudecode/index.js";
import {
  initializeWorkplaces,
  readWorkplaceResults,
} from "../agentruntime/workplaces/index.js";
import { createElectronShell } from "../electron/index.js";
import { createMessageBus } from "../messagebus/index.js";
import { readOutputManifest, writeOutput } from "../output/index.js";
import { applyKeysFromFile } from "../shared/keys.js";

// Apply keys from keys.txt to environment before checking
applyKeysFromFile();

const env = process.env;

if (env.CARVIS_REAL_MVP_SMOKE !== "1") {
  console.log("[mvp:real-smoke] skipped (set CARVIS_REAL_MVP_SMOKE=1)");
  process.exit(0);
}

assert(
  Boolean(env.ANTHROPIC_AUTH_TOKEN ?? env.DEEPSEEK_API_KEY),
  "real MVP smoke requires ANTHROPIC_AUTH_TOKEN or DEEPSEEK_API_KEY",
);

const bus = createMessageBus();
const smokeRoot = await mkdtemp(join(process.cwd(), ".carvis-real-mvp-"));
const workplacesRoot = join(smokeRoot, "workplaces");
const outputRoot = join(smokeRoot, "output");
const promptText = "build a real Claude Code MVP smoke";
let shutdownClaudeCodeRoleRunner: (() => void) | undefined;
await initializeWorkplaces(workplacesRoot, promptText);

const roleRunnerOptions = {
  env,
  workplacesRoot,
  cwd: smokeRoot,
  validateOutput: (role: string, output: string) => {
    const expected = `${role} real claude smoke ok`;

    assert(output === expected, `${role} expected ${expected}, got ${output}`);
  },
  promptForRole: (role: string) => {
    const expected = `${role} real claude smoke ok`;

    return `Reply exactly: ${expected}`;
  },
};
const roleRunner =
  env.CARVIS_REAL_MVP_USE_SDK === "1"
    ? createSdkRoleRunner(roleRunnerOptions)
    : createClaudeCodeRoleRunner(roleRunnerOptions);
const runtime = createAgentRuntime(bus, {
  roleRunner,
  outputWriter: async () => {
    const results = await readWorkplaceResults(workplacesRoot);

    return writeOutput({
      outputRootPath: outputRoot,
      title: "Carvis Real Claude MVP Smoke Output",
      workplaceResults: results.map((result) => ({
        role: result.role,
        sourcePath: result.resultPath,
        content: result.result,
      })),
    });
  },
});
const shell = createElectronShell(bus);

try {
  runtime.start();

  await shell.submitCommand(promptText, {
    requestId: "req-real-mvp-smoke-1",
  });

  const state = shell.getState();

  assert(state.outputs.length === 1, "real MVP output should be visible");
  assert(state.runtime.queueDepth === 0, "runtime queue should be empty");

  const manifest = await readOutputManifest(state.outputs[0]?.manifestPath ?? "");
  const finalReport = await readFile(state.outputs[0]?.outputPath ?? "", "utf8");

  assert(manifest.entries.length === 5, "manifest should include all five role outputs");

  for (const role of ["manager", "writer", "artist", "researcher", "engineer"] as const) {
    const expected = `${role} real claude smoke ok`;
    const panel = state.panels.find((item) => item.role === role);

    assert(panel?.status === "retained", `${role} panel should be retained`);
    assert(finalReport.includes(expected), `final report should include ${role} Claude result`);
  }

  console.log("[mvp:real-smoke] ok");
} finally {
  runtime.dispose();
  shell.dispose();
  shutdownClaudeCodeRoleRunner?.();

  if (env.CARVIS_KEEP_REAL_MVP_ARTIFACTS === "1") {
    console.log(`[mvp:real-smoke] artifacts kept at ${smokeRoot}`);
  } else {
    await rm(smokeRoot, { recursive: true, force: true });
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createSdkRoleRunner(options: typeof roleRunnerOptions) {
  const sdkRoleRunner = createClaudeCodeWarmSdkRoleRunner(options);

  shutdownClaudeCodeRoleRunner = sdkRoleRunner.shutdown;
  return sdkRoleRunner.runner;
}
