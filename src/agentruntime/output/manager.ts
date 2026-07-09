import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorkplaceManager } from "../workplaces/manager.js";
import type { AgentRole } from "../../shared/types/agent.js";

export interface OutputManifest {
  runId: string;
  createdAt: string;
  roles: Record<AgentRole, { resultPath: string }>;
  files: string[];
}

export interface OutputManager {
  readonly outputPath: string;
  generateOutput(runId: string, wm: WorkplaceManager): Promise<OutputManifest>;
  readOutput(): Promise<OutputManifest>;
}

export function createOutputManager(outputDir: string): OutputManager {
  const outputPath = outputDir;

  return {
    get outputPath() {
      return outputPath;
    },

    async generateOutput(runId, wm) {
      await mkdir(outputPath, { recursive: true });

      const roles: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];
      const roleMeta: Record<string, { resultPath: string }> = {};

      // Collect results from each role
      const reportParts: string[] = [
        `# Carvis Run Report`,
        `- runId: ${runId}`,
        `- createdAt: ${new Date().toISOString()}`,
        ``,
      ];

      for (const role of roles) {
        const resultPath = join(outputPath, "..", "workplaces", role, "result.md");
        reportParts.push(`## ${role}`);
        try {
          const content = await wm.readFile(role, "result.md");
          reportParts.push(content);
          roleMeta[role] = { resultPath };
        } catch {
          reportParts.push(`(no result from ${role})`);
          roleMeta[role] = { resultPath };
        }
      }

      const reportContent = reportParts.join("\n");
      const manifestJson = JSON.stringify(
        {
          runId,
          createdAt: new Date().toISOString(),
          roles: roleMeta,
          files: ["manifest.json", "report.md"],
        },
        null,
        2,
      );

      await writeFile(join(outputPath, "manifest.json"), manifestJson, "utf-8");
      await writeFile(join(outputPath, "report.md"), reportContent, "utf-8");

      return {
        runId,
        createdAt: new Date().toISOString(),
        roles: roleMeta as Record<AgentRole, { resultPath: string }>,
        files: ["manifest.json", "report.md"],
      };
    },

    async readOutput() {
      const raw = await readFile(join(outputPath, "manifest.json"), "utf-8");
      return JSON.parse(raw) as OutputManifest;
    },
  };
}

