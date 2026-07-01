import { spawn } from "node:child_process";

import { mergeClaudeCodeEnv } from "./deepseekClaudeCodeEnv.js";

export interface ClaudeCodeCommand {
  command: string;
  args: string[];
}

export interface ClaudeCodePrintOptions {
  env?: NodeJS.ProcessEnv;
  model?: string;
  maxBudgetUsd?: string;
  timeoutMs?: number;
  cwd?: string;
  systemPrompt?: string;
}

export interface ClaudeCodePrintResult {
  command: ClaudeCodeCommand;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export function createClaudeCodeCommand(args: string[], env: NodeJS.ProcessEnv): ClaudeCodeCommand {
  const bin = env.CARVIS_CLAUDE_CODE_BIN ?? "claude";
  const runner = env.CARVIS_CLAUDE_CODE_RUNNER;

  if (runner === undefined || runner.length === 0) {
    return {
      command: bin,
      args,
    };
  }

  return {
    command: runner,
    args: [bin, ...args],
  };
}

export async function runClaudeCodePrint(
  prompt: string,
  options: ClaudeCodePrintOptions = {},
): Promise<ClaudeCodePrintResult> {
  const env = options.env ?? process.env;
  const model = options.model ?? env.ANTHROPIC_MODEL ?? "deepseek-v4-flash";
  const maxBudgetUsd = options.maxBudgetUsd ?? "0.02";
  const bareArgs = env.CARVIS_CLAUDE_CODE_BARE === "0" ? [] : ["--bare"];
  const command = createClaudeCodeCommand(
    [
      ...bareArgs,
      "-p",
      prompt,
      "--system-prompt",
      options.systemPrompt ?? "You are a smoke test responder. Output exactly the requested text and nothing else.",
      "--model",
      model,
      "--tools",
      "",
      "--permission-mode",
      "dontAsk",
      "--no-session-persistence",
      "--max-budget-usd",
      maxBudgetUsd,
    ],
    env,
  );

  return spawnClaudeCode(command, mergeClaudeCodeEnv(env), options.timeoutMs ?? 60_000, options.cwd);
}

function spawnClaudeCode(
  command: ClaudeCodeCommand,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  cwd: string | undefined,
): Promise<ClaudeCodePrintResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`claude code timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      resolve({
        command,
        exitCode,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
  });
}
