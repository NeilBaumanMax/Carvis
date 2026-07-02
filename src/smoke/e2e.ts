import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgentRuntime } from "../agentruntime/index.js";
import {
  initializeWorkplaces,
  readWorkplaceResults,
  writeWorkplaceResult,
} from "../agentruntime/workplaces/index.js";
import { createElectronShell } from "../electron/index.js";
import { createMessageBus } from "../messagebus/index.js";
import { readOutputManifest, writeOutput } from "../output/index.js";

const bus = createMessageBus();
const smokeRoot = await mkdtemp(join(tmpdir(), "carvis-e2e-"));
const workplacesRoot = join(smokeRoot, "workplaces");
const outputRoot = join(smokeRoot, "output");
await initializeWorkplaces(workplacesRoot, "build a complete local MVP smoke");

const runtime = createAgentRuntime(bus, {
  roleRunner: async ({ agent }) => {
    await writeWorkplaceResult(workplacesRoot, agent.role, `${agent.role} completed MVP smoke work`);
  },
  outputWriter: async () => {
    const results = await readWorkplaceResults(workplacesRoot);

    return writeOutput({
      outputRootPath: outputRoot,
      title: "Carvis MVP Smoke Output",
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

  await shell.submitCommand("build a complete local MVP smoke", {
    requestId: "req-e2e-smoke-1",
  });

  const state = shell.getState();

  assert(state.submittedCommands[0] === "build a complete local MVP smoke", "command should be submitted");
  assert(state.outputs.length === 1, "output entry should be visible");
  assert(state.outputs[0]?.outputPath.endsWith("final-report.md"), "output path should point to final report");
  assert(state.runtime.queueDepth === 0, "runtime queue should be empty");
  assert(state.runtime.retainedPidCount === 5, "runtime should retain all five agents after run");

  for (const role of ["manager", "writer", "artist", "researcher", "engineer"] as const) {
    const panel = state.panels.find((item) => item.role === role);

    assert(panel !== undefined, `${role} panel should exist`);
    assert(panel.status === "retained", `${role} panel should show retained`);
    assert(panel.pid !== undefined, `${role} panel should show PID`);
    assert(panel.latestOutput !== undefined, `${role} panel should show latest output`);
  }

  const manifest = await readOutputManifest(state.outputs[0]?.manifestPath ?? "");
  const finalReport = await readFile(state.outputs[0]?.outputPath ?? "", "utf8");

  assert(manifest.entries.length === 5, "manifest should include all role results");
  assert(finalReport.includes("Carvis MVP Smoke Output"), "final report should include title");
  assert(finalReport.includes("engineer completed MVP smoke work"), "final report should include engineer result");

  console.log("[e2e:smoke] ok");
} finally {
  runtime.dispose();
  shell.dispose();
  await rm(smokeRoot, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
