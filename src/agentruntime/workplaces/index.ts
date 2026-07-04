import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentRole } from "../../shared/types/agent.js";

export const WORKPLACE_ROLES: readonly AgentRole[] = [
  "manager",
  "writer",
  "artist",
  "researcher",
  "engineer",
];

export interface WorkplacesOptions {
  rootDir?: string;
}

export class Workplaces {
  constructor(private readonly rootDir = "workplaces") {}

  async ensure(): Promise<void> {
    for (const role of WORKPLACE_ROLES) {
      await mkdir(this.rolePath(role, "artifacts"), { recursive: true });
      await writeFile(this.rolePath(role, ".gitkeep"), "", { flag: "a" });
    }
  }

  async writeTaskFile(role: AgentRole, content: string): Promise<string> {
    await this.ensureRole(role);
    const path = this.rolePath(role, "task.md");
    await writeFile(path, content);
    return path;
  }

  async writePlan(role: AgentRole, content: string): Promise<string> {
    await this.ensureRole(role);
    const path = this.rolePath(role, "plan.md");
    await writeFile(path, content);
    return path;
  }

  async writeRoleOutput(role: AgentRole, content: string): Promise<string> {
    await this.ensureRole(role);
    const path = this.rolePath(role, "result.md");
    await writeFile(path, content);
    return path;
  }

  async readRoleOutput(role: AgentRole): Promise<string> {
    return await readFile(this.rolePath(role, "result.md"), "utf8");
  }

  getRolePath(role: AgentRole): string {
    return this.rolePath(role);
  }

  private async ensureRole(role: AgentRole): Promise<void> {
    await mkdir(this.rolePath(role, "artifacts"), { recursive: true });
  }

  private rolePath(role: AgentRole, filename?: string): string {
    if (filename === undefined) {
      return join(this.rootDir, role);
    }

    return join(this.rootDir, role, filename);
  }
}

export function createWorkplaces(options: WorkplacesOptions = {}): Workplaces {
  return new Workplaces(options.rootDir);
}
