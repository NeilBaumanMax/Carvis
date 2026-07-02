import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentRole } from "../../shared/types/agent.js";
import { renderAgentPlanMarkdown, renderAgentSkillMarkdown } from "../skills/index.js";

export const WORKPLACE_ROLES: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];
export const WORKPLACE_FILES = ["input.md", "skill.md", "plan.md", "log.md", "result.md"] as const;

export interface WorkplacePaths {
  role: AgentRole;
  rootPath: string;
  inputPath: string;
  skillPath: string;
  planPath: string;
  logPath: string;
  resultPath: string;
}

export interface WorkplaceResult {
  role: AgentRole;
  result: string;
  resultPath: string;
}

export async function initializeWorkplaces(rootPath: string, commandText: string): Promise<WorkplacePaths[]> {
  await mkdir(rootPath, { recursive: true });

  const workplaces = WORKPLACE_ROLES.map((role) => createWorkplacePaths(rootPath, role));

  for (const workplace of workplaces) {
    await mkdir(workplace.rootPath, { recursive: true });
    await writeFile(workplace.inputPath, `# Input\n\n${commandText}\n`, "utf8");
    await writeFile(workplace.skillPath, `${renderAgentSkillMarkdown(workplace.role)}\n`, "utf8");
    await writeFile(workplace.planPath, renderAgentPlanMarkdown(workplace.role), "utf8");
    await writeFile(
      workplace.logPath,
      `# Log\n\nInitialized ${workplace.role} workplace with 3 installed skills.\n`,
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

  return {
    role,
    rootPath: roleRoot,
    inputPath: join(roleRoot, "input.md"),
    skillPath: join(roleRoot, "skill.md"),
    planPath: join(roleRoot, "plan.md"),
    logPath: join(roleRoot, "log.md"),
    resultPath: join(roleRoot, "result.md"),
  };
}
