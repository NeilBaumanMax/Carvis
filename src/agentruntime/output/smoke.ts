import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkplaceManager } from "../workplaces/manager.js";
import { createOutputManager } from "./manager.js";

async function run(): Promise<void> {
  const baseDir = mkdtempSync(join(tmpdir(), "carvis-output-test-"));
  const outputDir = join(baseDir, "output");
  const workplaceRoot = join(baseDir, "workplaces");

  const wm = createWorkplaceManager(workplaceRoot);
  const om = createOutputManager(outputDir);

  try {
    await wm.initAll();

    // Write a result to each role workplace
    const roles = ["manager", "writer", "artist", "researcher", "engineer"] as const;
    for (const role of roles) {
      await wm.writeFile(role, "result.md", `# ${role} result\n\nTest output.`);
    }

    // Generate output
    const manifest = await om.generateOutput("run-test", wm);

    // 1. manifest.json structure
    if (manifest.runId !== "run-test") {
      throw new Error(`expected run-test, got ${manifest.runId}`);
    }
    console.log("[output:smoke] manifest runId: ok");

    // 2. roles object has 5 entries
    const roleCount = Object.keys(manifest.roles).length;
    if (roleCount !== 5) {
      throw new Error(`expected 5 roles, got ${roleCount}`);
    }
    console.log("[output:smoke] roles count: ok");

    // 3. files array has 2 entries
    if (manifest.files.length !== 2) {
      throw new Error(`expected 2 files, got ${manifest.files.length}`);
    }
    console.log("[output:smoke] files count: ok");

    // 4. manifest.json exists on disk
    const manifestPath = join(outputDir, "manifest.json");
    const manifestRaw = readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(manifestRaw);
    if (parsed.runId !== "run-test" || Object.keys(parsed.roles).length !== 5) {
      throw new Error("manifest.json on disk mismatch");
    }
    console.log("[output:smoke] manifest.json on disk: ok");

    // 5. report.md exists on disk and contains role sections
    const reportRaw = readFileSync(join(outputDir, "report.md"), "utf-8");
    for (const role of roles) {
      if (!reportRaw.includes(`## ${role}`)) {
        throw new Error(`report.md missing ${role} section`);
      }
    }
    console.log("[output:smoke] report.md role sections: ok");

    // 6. readOutput round-trip consistency
    const reread = await om.readOutput();
    if (reread.runId !== manifest.runId || reread.files.length !== manifest.files.length) {
      throw new Error("readOutput round-trip mismatch");
    }
    console.log("[output:smoke] readOutput round-trip: ok");

    console.log("[output:smoke] ok");
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error("[output:smoke] FAIL", err.message ?? err);
  process.exitCode = 1;
});
