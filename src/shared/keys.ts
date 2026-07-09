import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads keys.txt from the project root and applies values to process.env.
 * Respects existing env vars — won't override them if already set.
 * Called by agentruntime/main.ts and smoke/realMvp.ts before starting AI calls.
 */
export function applyKeysFromFile(projectRoot?: string): void {
  const root = projectRoot ?? process.cwd();
  const keysPath = join(root, "keys.txt");

  if (!existsSync(keysPath)) {
    console.log("[keys] keys.txt not found, continuing with env vars only");
    return;
  }

  const content = readFileSync(keysPath, "utf-8");
  let loaded = 0;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key.length > 0 && value.length > 0 && process.env[key] === undefined) {
      process.env[key] = value;
      loaded += 1;
    }
  }

  if (loaded > 0) {
    console.log(`[keys] loaded ${loaded} key(s) from keys.txt`);
  }
}
