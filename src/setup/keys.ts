import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface KeyStore {
  readonly ANTHROPIC_AUTH_TOKEN?: string;
  readonly DEEPSEEK_API_KEY?: string;
}

export function readKeysFile(projectRoot: string): KeyStore {
  const keysPath = join(projectRoot, "keys.txt");
  if (!existsSync(keysPath)) {
    console.warn("[keys] keys.txt not found, running without auth token");
    return {};
  }

  const content = readFileSync(keysPath, "utf-8");
  const store: Record<string, string> = {};

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
    if (key.length > 0 && value.length > 0) {
      store[key] = value;
    }
  }

  return {
    ANTHROPIC_AUTH_TOKEN: store.ANTHROPIC_AUTH_TOKEN,
    DEEPSEEK_API_KEY: store.DEEPSEEK_API_KEY,
  };
}

export function applyKeysToEnv(projectRoot: string): void {
  const keys = readKeysFile(projectRoot);

  if (keys.ANTHROPIC_AUTH_TOKEN) {
    process.env.ANTHROPIC_AUTH_TOKEN = keys.ANTHROPIC_AUTH_TOKEN;
  } else if (keys.DEEPSEEK_API_KEY) {
    process.env.ANTHROPIC_AUTH_TOKEN = keys.DEEPSEEK_API_KEY;
  }

  if (process.env.ANTHROPIC_AUTH_TOKEN) {
    const masked = process.env.ANTHROPIC_AUTH_TOKEN.slice(0, 10) + "...";
    console.log(`[keys] ANTHROPIC_AUTH_TOKEN set: ${masked}`);
  } else {
    console.log("[keys] no auth token found in keys.txt");
  }
}
