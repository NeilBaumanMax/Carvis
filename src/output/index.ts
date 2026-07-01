import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentRole } from "../shared/types/agent.js";
import type { OutputReadyPayload } from "../shared/types/events.js";

export interface OutputManifest {
  generatedAt: string;
  finalReportPath: string;
  entries: OutputManifestEntry[];
}

export interface OutputManifestEntry {
  role: AgentRole;
  sourcePath: string;
}

export interface WriteOutputOptions {
  outputRootPath: string;
  title: string;
  workplaceResults: OutputManifestEntryWithContent[];
}

export interface OutputManifestEntryWithContent extends OutputManifestEntry {
  content: string;
}

export async function writeOutput(options: WriteOutputOptions): Promise<OutputReadyPayload> {
  await mkdir(options.outputRootPath, { recursive: true });

  const finalReportPath = join(options.outputRootPath, "final-report.md");
  const manifestPath = join(options.outputRootPath, "manifest.json");
  const finalReport = renderFinalReport(options.title, options.workplaceResults);
  const manifest: OutputManifest = {
    generatedAt: new Date().toISOString(),
    finalReportPath,
    entries: options.workplaceResults.map((entry) => ({
      role: entry.role,
      sourcePath: entry.sourcePath,
    })),
  };

  await writeFile(finalReportPath, finalReport, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    outputPath: finalReportPath,
    manifestPath,
  };
}

export async function readOutputManifest(manifestPath: string): Promise<OutputManifest> {
  return JSON.parse(await readFile(manifestPath, "utf8")) as OutputManifest;
}

function renderFinalReport(title: string, entries: OutputManifestEntryWithContent[]): string {
  const sections = entries.map((entry) => `## ${entry.role}\n\n${entry.content.trim()}`).join("\n\n");

  return `# ${title}\n\n${sections}\n`;
}
