import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createWorkplacePaths,
  initializeWorkplaces,
  readWorkplaceResults,
  writeManagerReview,
  writeWorkplaceResult,
  WORKPLACE_ROLES,
} from "./index.js";

const rootPath = await mkdtemp(join(tmpdir(), "carvis-workplaces-"));

try {
  await initializeWorkplaces(rootPath, "build a workplace smoke");

  for (const role of WORKPLACE_ROLES) {
    const workplace = createWorkplacePaths(rootPath, role);
    const skill = await readFile(workplace.skillPath, "utf8");
    const installedSkillCount = (skill.match(/^### /gm) ?? []).length;

    assert(skill.includes("## Installed Skills"), `${role} should have an installed skill file`);
    assert(installedSkillCount === 3, `${role} should have exactly 3 installed skills`);

    await writeWorkplaceResult(rootPath, role, `${role} smoke result`);
  }

  await writeManagerReview(rootPath, "审核结论：writer、artist、researcher 全部通过，允许 engineer 制作。");

  const results = await readWorkplaceResults(rootPath);
  const managerWorkplace = createWorkplacePaths(rootPath, "manager");
  const managerReview = await readFile(managerWorkplace.reviewPath, "utf8");
  const managerResult = results.find((result) => result.role === "manager")?.result ?? "";

  assert(results.length === WORKPLACE_ROLES.length, "should read all workplace results");
  assert(
    results.every((result) => result.result.includes(`${result.role} smoke result`)),
    "each workplace should keep its own result",
  );
  assert(managerReview.includes("全部通过"), "manager review file should record review gate");
  assert(managerResult.includes("Manager Review Gate"), "manager result should include review gate for output");

  console.log("[workplaces:smoke] ok");
} finally {
  await rm(rootPath, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
