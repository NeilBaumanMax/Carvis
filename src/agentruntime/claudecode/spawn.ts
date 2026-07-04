import { spawn, type ChildProcess } from "node:child_process";
import type { DeepSeekClaudeCodeEnv } from "./deepseekClaudeCodeEnv.js";
import { mergeClaudeCodeEnv } from "./deepseekClaudeCodeEnv.js";

export interface ClaudeCodeProcess {
  readonly pid: number | undefined;
  writeInput(text: string): void;
  closeStdin(): void;
  kill(signal?: NodeJS.Signals): boolean;
  onStdoutLine(callback: (line: string) => void): void;
  onStderrLine(callback: (line: string) => void): void;
  onExit(callback: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  onError(callback: (err: Error) => void): void;
}

export interface SpawnConfig {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export function spawnClaudeCode(config: SpawnConfig): ClaudeCodeProcess {
  const mergedEnv = mergeClaudeCodeEnv({ ...process.env, ...config.env });
  const args: string[] = config.args ?? [];

  const child: ChildProcess = spawn(config.command, args, {
    cwd: config.cwd,
    env: mergedEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let exitCallbacks: Array<(code: number | null, signal: NodeJS.Signals | null) => void> = [];
  let errorCallbacks: Array<(err: Error) => void> = [];

  // Timeout handling
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (config.timeoutMs !== undefined && config.timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      const err = new Error(`process timed out after ${config.timeoutMs}ms`);
      for (const cb of errorCallbacks) {
        cb(err);
      }
    }, config.timeoutMs);
  }

  const listenerCleanup: Array<() => void> = [];

  // Forward child error events
  child.on("error", (err) => {
    for (const cb of errorCallbacks) {
      cb(err);
    }
  });

  child.on("exit", (code, signal) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    for (const cb of exitCallbacks) {
      cb(code, signal);
    }
  });

  return {
    get pid() {
      return child.pid;
    },

    writeInput(text) {
      if (child.stdin !== null && !child.stdin.destroyed) {
        child.stdin.write(text);
      }
    },

    closeStdin() {
      if (child.stdin !== null && !child.stdin.destroyed) {
        child.stdin.end();
      }
    },

    kill(signal) {
      return child.kill(signal);
    },

    onStdoutLine(callback) {
      let buf = "";
      const handler = (chunk: Buffer) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          callback(line);
        }
      };
      child.stdout?.on("data", handler);
      listenerCleanup.push(() => child.stdout?.off("data", handler));
    },

    onStderrLine(callback) {
      let buf = "";
      const handler = (chunk: Buffer) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          callback(line);
        }
      };
      child.stderr?.on("data", handler);
      listenerCleanup.push(() => child.stderr?.off("data", handler));
    },

    onExit(callback) {
      exitCallbacks.push(callback);
    },

    onError(callback) {
      errorCallbacks.push(callback);
    },
  };
}

export function isClaudeCodeAvailable(command?: string): boolean {
  // Check env vars first - if ANTHROPIC_AUTH_TOKEN is set, we can attempt
  const effectiveEnv = mergeClaudeCodeEnv(process.env);
  return effectiveEnv.ANTHROPIC_AUTH_TOKEN !== undefined && effectiveEnv.ANTHROPIC_AUTH_TOKEN !== "";
}
