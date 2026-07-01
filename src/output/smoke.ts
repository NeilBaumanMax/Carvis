import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readOutputManifest, writeOutput } from "./index.js";

const rootPath = await mkdtemp(join(tmpdir(), "carvis-output-"));

try {
  const output = await writeOutput({
    outputRootPath: rootPath,
    title: "Output Smoke",
    workplaceResults: [
      {
        role: "manager",
        sourcePath: "workplaces/manager/result.md",
        content: "manager result",
      },
    ],
  });
  const manifest = await readOutputManifest(output.manifestPath ?? "");

  assert(output.outputPath.endsWith("final-report.md"), "final report path should be returned");
  assert(manifest.entries[0]?.role === "manager", "manifest should include role entry");

  console.log("[output:smoke] ok");
} finally {
  await rm(rootPath, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
