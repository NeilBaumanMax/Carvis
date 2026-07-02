import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentRole } from "../../shared/types/agent.js";
import {
  classifyTaskSkill,
  renderAgentCommonMarkdown,
  renderAgentPlanMarkdown,
  renderAgentSkillMarkdown,
  renderSelectedTaskSkillMarkdown,
  renderTaskSkillMarkdown,
  type TaskSkillId,
} from "../skills/index.js";

export const WORKPLACE_ROLES: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];
export const WORKPLACE_FILES = ["input.md", "skill.md", "plan.md", "log.md", "result.md"] as const;
const TASK_SKILLS: TaskSkillId[] = ["galgame", "platformer", "shop-autobattler", "repo-doc", "generic-game"];

export interface WorkplacePaths {
  role: AgentRole;
  rootPath: string;
  inputPath: string;
  skillPath: string;
  planPath: string;
  logPath: string;
  reviewPath: string;
  resultPath: string;
  commonRootPath: string;
  commonRolePath: string;
  commonPolicyPath: string;
  skillsRootPath: string;
  selectedSkillPath: string;
  taskStatePath: string;
  handoffPath: string;
  evidenceIndexPath: string;
}

export interface WorkplaceResult {
  role: AgentRole;
  result: string;
  resultPath: string;
}

export async function initializeWorkplaces(rootPath: string, commandText: string): Promise<WorkplacePaths[]> {
  await mkdir(rootPath, { recursive: true });
  const selectedSkill = classifyTaskSkill(commandText);

  const workplaces = WORKPLACE_ROLES.map((role) => createWorkplacePaths(rootPath, role));

  for (const workplace of workplaces) {
    await mkdir(workplace.rootPath, { recursive: true });
    await mkdir(workplace.commonRootPath, { recursive: true });
    await mkdir(workplace.skillsRootPath, { recursive: true });
    await writeFile(workplace.inputPath, `# Input\n\n${commandText}\n`, "utf8");
    await writeFile(workplace.skillPath, `${renderAgentSkillMarkdown(workplace.role)}\n`, "utf8");
    await writeFile(workplace.planPath, renderAgentPlanMarkdown(workplace.role), "utf8");
    await writeFile(workplace.commonRolePath, `${renderAgentCommonMarkdown(workplace.role)}\n`, "utf8");
    await writeFile(
      workplace.commonPolicyPath,
      renderCommonPolicyMarkdown(workplace.role, selectedSkill),
      "utf8",
    );
    for (const taskSkill of TASK_SKILLS) {
      await writeFile(
        join(workplace.skillsRootPath, `${taskSkill}.md`),
        `${renderTaskSkillMarkdown(workplace.role, taskSkill)}\n`,
        "utf8",
      );
    }
    await writeFile(workplace.selectedSkillPath, `${renderSelectedTaskSkillMarkdown(workplace.role, commandText)}\n`, "utf8");
    await writeFile(workplace.taskStatePath, `${renderInitialTaskState(commandText, selectedSkill)}\n`, "utf8");
    await writeFile(workplace.handoffPath, `${renderInitialHandoff(workplace.role)}\n`, "utf8");
    await writeFile(workplace.evidenceIndexPath, `${renderInitialEvidenceIndex(workplace.role)}\n`, "utf8");
    await writeFile(
      workplace.logPath,
      `# Log\n\nInitialized ${workplace.role} workplace with common policy and ${TASK_SKILLS.length} task skills. Selected skill: ${selectedSkill}.\n`,
      "utf8",
    );
    await writeFile(workplace.resultPath, `# Result\n\nPending result for ${workplace.role}.\n`, "utf8");
  }

  return workplaces;
}

export async function writeWorkplaceResult(
  rootPath: string,
  role: AgentRole,
  result: string,
): Promise<WorkplaceResult> {
  const workplace = createWorkplacePaths(rootPath, role);
  await mkdir(workplace.rootPath, { recursive: true });
  await writeFile(workplace.resultPath, `# Result\n\n${result}\n`, "utf8");
  await writeFile(workplace.logPath, `# Log\n\nCompleted ${role} result.\n`, "utf8");

  return {
    role,
    result,
    resultPath: workplace.resultPath,
  };
}

export async function writeManagerReview(rootPath: string, review: string): Promise<WorkplaceResult> {
  const workplace = createWorkplacePaths(rootPath, "manager");
  await mkdir(workplace.rootPath, { recursive: true });

  let existingResult = "";
  try {
    existingResult = await readFile(workplace.resultPath, "utf8");
  } catch {
    existingResult = "# Result\n";
  }

  const combinedResult = [
    existingResult.trimEnd(),
    "",
    "## Manager Review Gate",
    "",
    review.trim(),
    "",
  ].join("\n");

  await writeFile(workplace.reviewPath, `# Manager Review Gate\n\n${review.trim()}\n`, "utf8");
  await writeFile(workplace.resultPath, `${combinedResult}\n`, "utf8");
  await writeFile(workplace.logPath, "# Log\n\nCompleted manager review gate.\n", "utf8");

  return {
    role: "manager",
    result: combinedResult,
    resultPath: workplace.resultPath,
  };
}

export async function readWorkplaceResults(rootPath: string): Promise<WorkplaceResult[]> {
  const results: WorkplaceResult[] = [];

  for (const role of WORKPLACE_ROLES) {
    const workplace = createWorkplacePaths(rootPath, role);
    const result = await readFile(workplace.resultPath, "utf8");

    results.push({
      role,
      result,
      resultPath: workplace.resultPath,
    });
  }

  return results;
}

export function createWorkplacePaths(rootPath: string, role: AgentRole): WorkplacePaths {
  const roleRoot = join(rootPath, role);
  const commonRoot = join(roleRoot, "common");
  const skillsRoot = join(roleRoot, "skills");

  return {
    role,
    rootPath: roleRoot,
    inputPath: join(roleRoot, "input.md"),
    skillPath: join(roleRoot, "skill.md"),
    planPath: join(roleRoot, "plan.md"),
    logPath: join(roleRoot, "log.md"),
    reviewPath: join(roleRoot, "review.md"),
    resultPath: join(roleRoot, "result.md"),
    commonRootPath: commonRoot,
    commonRolePath: join(commonRoot, "role.md"),
    commonPolicyPath: join(commonRoot, "policy.md"),
    skillsRootPath: skillsRoot,
    selectedSkillPath: join(skillsRoot, "selected.md"),
    taskStatePath: join(roleRoot, "task_state.json"),
    handoffPath: join(roleRoot, "handoff_to_engineer.json"),
    evidenceIndexPath: join(roleRoot, "evidence_index.json"),
  };
}

function renderCommonPolicyMarkdown(role: AgentRole, selectedSkill: TaskSkillId): string {
  return [
    "# Common Policy",
    "",
    `Role: ${role}`,
    `Selected task skill: ${selectedSkill}`,
    "",
    "## 分层上下文规则",
    "",
    "- Raw artifact: `result.md`、`review.md`、图片和 HTML 原文只作证据，不默认全量塞给下游。",
    "- Role contract: 本角色输出必须提炼 facts / decisions / assets / constraints / risks / handoff。",
    "- Task state: `task_state.json` 记录任务类型、必须项、资产、机制、验收和风险。",
    "- Evidence index: `evidence_index.json` 记录关键事实来自哪个角色文件。",
    "- Compression policy: 下游优先读取 task_state 和 handoff，再按 evidence index 查证细节。",
    "",
    "## 输出约束",
    "",
    "- 结果中必须有 `## Handoff Contract` 小节，列出给下游的结构化要点。",
    "- 如果是 engineer，必须输出真实 HTML，不得输出方案替代。",
    "",
  ].join("\n");
}

function renderInitialTaskState(commandText: string, selectedSkill: TaskSkillId): string {
  return JSON.stringify(
    {
      task_type: selectedSkill,
      source: "initial",
      command_text: commandText,
      must_have: [],
      assets: [],
      mechanics: [],
      acceptance: [],
      risks: [],
      updated_by: [],
    },
    null,
    2,
  );
}

function renderInitialHandoff(role: AgentRole): string {
  return JSON.stringify(
    {
      role,
      facts: [],
      decisions: [],
      assets: [],
      constraints: [],
      open_risks: [],
      handoff_to_engineer: [],
    },
    null,
    2,
  );
}

function renderInitialEvidenceIndex(role: AgentRole): string {
  return JSON.stringify(
    {
      role,
      entries: [],
    },
    null,
    2,
  );
}
