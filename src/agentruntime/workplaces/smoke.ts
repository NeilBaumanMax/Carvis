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
  await initializeWorkplaces(rootPath, "build a game workplace smoke");

  for (const role of WORKPLACE_ROLES) {
    const workplace = createWorkplacePaths(rootPath, role);
    const skill = await readFile(workplace.skillPath, "utf8");
    const commonRole = await readFile(workplace.commonRolePath, "utf8");
    const commonPolicy = await readFile(workplace.commonPolicyPath, "utf8");
    const selectedSkill = await readFile(workplace.selectedSkillPath, "utf8");
    const taskState = JSON.parse(await readFile(workplace.taskStatePath, "utf8")) as {
      task_type?: string;
    };
    const handoff = JSON.parse(await readFile(workplace.handoffPath, "utf8")) as {
      handoff_to_engineer?: unknown[];
    };
    const evidenceIndex = JSON.parse(await readFile(workplace.evidenceIndexPath, "utf8")) as {
      entries?: unknown[];
    };
    const installedSkillCount = (skill.match(/^### /gm) ?? []).length;

    assert(skill.includes("## Installed Skills"), `${role} should have an installed skill file`);
    assert(installedSkillCount === 3, `${role} should have exactly 3 installed skills`);
    assert(commonRole.includes("## 通用强制约束"), `${role} should have common role constraints`);
    assert(commonPolicy.includes("## 分层上下文规则"), `${role} should have layered context policy`);
    assert(selectedSkill.includes("通用游戏原型任务 skill"), `${role} should select generic game skill`);
    assert(taskState.task_type === "generic-game", `${role} should initialize classified task state`);
    assert(Array.isArray(handoff.handoff_to_engineer), `${role} should initialize handoff contract`);
    assert(Array.isArray(evidenceIndex.entries), `${role} should initialize evidence index`);

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
