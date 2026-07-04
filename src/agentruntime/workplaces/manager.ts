import { mkdir, writeFile, appendFile, readFile, access } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import type { AgentRole } from "../../shared/types/agent.js";
import { ROLE_FLOW } from "../types.js";

export const WORKPLACE_FILES = ["input.md", "plan.md", "log.md", "result.md"] as const;
export type WorkplaceFile = (typeof WORKPLACE_FILES)[number];

const ALL_ROLES: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];

export interface WorkplaceManager {
  get rootPath(): string;
  initAll(): Promise<void>;
  initRole(role: AgentRole): Promise<void>;
  getPath(role: AgentRole): string;
  writeFile(role: AgentRole, file: WorkplaceFile, content: string): Promise<void>;
  appendFile(role: AgentRole, file: WorkplaceFile, content: string): Promise<void>;
  readFile(role: AgentRole, file: WorkplaceFile): Promise<string>;
  fileExists(role: AgentRole, file: WorkplaceFile): Promise<boolean>;
  getPriorRoles(role: AgentRole): AgentRole[];
  collectPriorResults(role: AgentRole): Promise<string>;
  verifyPath(role: AgentRole, filePath: string): boolean;
}

export function createWorkplaceManager(rootPath: string): WorkplaceManager {
  const resolvedRoot = resolve(rootPath);

  function verifyWithinWorkplace(role: AgentRole, absPath: string): boolean {
    const workplaceDir = join(resolvedRoot, role);
    const resolvedTarget = resolve(absPath);
    return resolvedTarget.startsWith(workplaceDir + "/") || resolvedTarget === workplaceDir;
  }

  function getPriorRoles(role: AgentRole): AgentRole[] {
    const prior: AgentRole[] = [];
    for (const step of ROLE_FLOW) {
      if (step.kind === "sequential" && step.role === role) {
        break;
      }
      if (step.kind === "sequential") {
        prior.push(step.role);
      } else if (step.kind === "parallel" && step.roles.includes(role)) {
        // When entering parallel block, pick up prior sequential roles
        break;
      } else if (step.kind === "parallel") {
        // This parallel block is before the target role
        for (const r of step.roles) {
          prior.push(r);
        }
      }
    }

    // For engineer specifically, include all roles except engineer itself
    if (role === "engineer") {
      const allPrior: AgentRole[] = [];
      for (const step of ROLE_FLOW) {
        if (step.kind === "sequential" && step.role === "engineer") {
          break;
        }
        if (step.kind === "sequential") {
          allPrior.push(step.role);
        } else {
          for (const r of step.roles) {
            allPrior.push(r);
          }
        }
      }
      return allPrior;
    }

    return prior;
  }

  return {
    get rootPath() {
      return resolvedRoot;
    },

    async initAll() {
      for (const role of ALL_ROLES) {
        await this.initRole(role);
      }
    },

    async initRole(role) {
      const dir = join(resolvedRoot, role);
      await mkdir(dir, { recursive: true });

      const defaultContent: Record<WorkplaceFile, string> = {
        "input.md": `# ${role} - Input\n\n`,
        "plan.md": `# ${role} - Plan\n\n`,
        "log.md": `# ${role} - Log\n\n`,
        "result.md": `# ${role} - Result\n\n`,
      };

      for (const file of WORKPLACE_FILES) {
        const filePath = join(dir, file);
        try {
          await access(filePath);
        } catch {
          await writeFile(filePath, defaultContent[file], "utf-8");
        }
      }
    },

    getPath(role) {
      return join(resolvedRoot, role);
    },

    async writeFile(role, file, content) {
      if (!WORKPLACE_FILES.includes(file)) {
        throw new Error(`unknown workplace file: ${file}`);
      }
      const filePath = join(resolvedRoot, role, file);
      if (!verifyWithinWorkplace(role, filePath)) {
        throw new Error(`role ${role} cannot write outside its workplace`);
      }
      await writeFile(filePath, content, "utf-8");
    },

    async appendFile(role, file, content) {
      if (!WORKPLACE_FILES.includes(file)) {
        throw new Error(`unknown workplace file: ${file}`);
      }
      const filePath = join(resolvedRoot, role, file);
      if (!verifyWithinWorkplace(role, filePath)) {
        throw new Error(`role ${role} cannot write outside its workplace`);
      }
      await appendFile(filePath, content, "utf-8");
    },

    async readFile(role, file) {
      if (!WORKPLACE_FILES.includes(file)) {
        throw new Error(`unknown workplace file: ${file}`);
      }
      const filePath = join(resolvedRoot, role, file);
      return readFile(filePath, "utf-8");
    },

    async fileExists(role, file) {
      const filePath = join(resolvedRoot, role, file);
      try {
        await access(filePath);
        return true;
      } catch {
        return false;
      }
    },

    getPriorRoles,

    async collectPriorResults(role) {
      const priors = getPriorRoles(role);
      const parts: string[] = [];

      for (const prior of priors) {
        try {
          const result = await readFile(join(resolvedRoot, prior, "result.md"), "utf-8");
          parts.push(`## ${prior} Output\n\n${result}`);
        } catch {
          parts.push(`## ${prior} Output\n\n(no result available)\n`);
        }
      }

      return parts.join("\n\n");
    },

    verifyPath(role, filePath) {
      return verifyWithinWorkplace(role, filePath);
    },
  };
}
