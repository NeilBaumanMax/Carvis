import { createWorkplaceManager } from "./manager.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";

async function main() {
  const testRoot = join(tmpdir(), "carvis-smoke-workplaces-" + Date.now());
  console.log(`[smoke] workplace root: ${testRoot}`);

  const wm = createWorkplaceManager(testRoot);

  // 1. Init all workplaces
  await wm.initAll();
  console.log("ok 1 - initAll completes without error");

  // 2. Check directories exist
  const roles = ["manager", "writer", "artist", "researcher", "engineer"];
  for (const role of roles) {
    for (const file of ["input.md", "plan.md", "log.md", "result.md"]) {
      const exists = await wm.fileExists(role as any, file as any);
      console.log(`ok - ${role}/${file} exists=${exists}`);
      if (!exists) {
        process.exitCode = 1;
      }
    }
  }
  console.log("ok 2 - all workplace files created");

  // 3. Write isolation: each role can write its own workplace
  await wm.writeFile("manager", "input.md", "# manager input");
  const input = await wm.readFile("manager", "input.md");
  console.log(`ok - manager input read: "${input.trim()}"`);

  // 4. Role isolation: a role cannot access wrong workplace (tested via verifyPath)
  const managerPath = wm.getPath("manager");
  const engineerPath = wm.getPath("engineer");
  const crossCheck = wm.verifyPath("writer", join(engineerPath, "input.md"));
  console.log(`ok - cross-role verifyPath: ${crossCheck} (should be false)`);
  if (crossCheck) process.exitCode = 1;
  const selfCheck = wm.verifyPath("writer", join(wm.getPath("writer"), "input.md"));
  console.log(`ok - self-role verifyPath: ${selfCheck} (should be true)`);
  if (!selfCheck) process.exitCode = 1;

  // 5. Prior roles: engineer should have manager, writer, artist, researcher as priors
  const engineerPriors = wm.getPriorRoles("engineer");
  console.log(`ok - engineer priors: [${engineerPriors}]`);
  if (
    !engineerPriors.includes("manager") ||
    !engineerPriors.includes("writer") ||
    !engineerPriors.includes("artist") ||
    !engineerPriors.includes("researcher")
  ) {
    process.exitCode = 1;
  }

  // 6. collectPriorResults
  await wm.writeFile("manager", "result.md", "manager result v1");
  await wm.writeFile("writer", "result.md", "writer result v1");
  await wm.writeFile("artist", "result.md", "artist result v1");
  await wm.writeFile("researcher", "result.md", "researcher result v1");
  const collected = await wm.collectPriorResults("engineer");
  console.log(`ok - collected prior results length: ${collected.length}`);
  if (!collected.includes("manager")) process.exitCode = 1;
  if (!collected.includes("writer")) process.exitCode = 1;
  if (!collected.includes("artist")) process.exitCode = 1;
  if (!collected.includes("researcher")) process.exitCode = 1;

  // 7. Append to log
  await wm.appendFile("manager", "log.md", "started task\n");
  const log = await wm.readFile("manager", "log.md");
  console.log(`ok - append to log: "${log.trim().split('\n').pop()}"`);

  // Cleanup
  await rm(testRoot, { recursive: true, force: true });

  if (process.exitCode === undefined || process.exitCode === 0) {
    console.log("\n[smoke] workplaces:smoke PASSED");
  } else {
    console.log("\n[smoke] workplaces:smoke FAILED");
  }
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
