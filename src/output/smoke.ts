import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  const gamePreview = await readFile(output.gamePreviewPath ?? "", "utf8");

  assert(output.outputPath.endsWith("final-report.md"), "final report path should be returned");
  assert(output.outputPath.startsWith("/"), "final report path should be absolute");
  assert(manifest.entries[0]?.role === "manager", "manifest should include role entry");

  const gameOutput = await writeOutput({
    outputRootPath: rootPath,
    title: "Game Output Smoke",
    workplaceResults: [
      {
        role: "engineer",
        sourcePath: "workplaces/engineer/result.md",
        content: "```html\n<html><body><canvas id=\"game\"></canvas><script>window.ok=true;</script></body></html>\n```",
      },
    ],
  });
  const playablePreview = await readFile(gameOutput.gamePreviewPath ?? "", "utf8");

  assert(gamePreview.includes("Generated Design Report"), "fallback preview should include report");
  assert(playablePreview.includes("<canvas id=\"game\"></canvas>"), "engineer HTML should become game preview");

  console.log("[output:smoke] ok");
} finally {
  await rm(rootPath, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
