import { spawn } from "node:child_process";

import type { MessageBus } from "../../messagebus/index.js";
import type { AgentRole } from "../../shared/types/agent.js";
import type { AgentOutputPayload } from "../../shared/types/events.js";
import { mergeClaudeCodeEnv } from "./deepseekClaudeCodeEnv.js";

export interface ClaudeCodeAgentRunOptions {
  role: AgentRole;
  prompt: string;
  cwd?: string;
  command?: string;
  args?: readonly string[];
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  bus?: MessageBus;
  runId?: string;
  requestId?: string;
  agentId?: string;
}

export interface ClaudeCodeAgentRunResult {
  pid?: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
}

export class ClaudeCodeAgentError extends Error {
  constructor(
    message: string,
    readonly result: ClaudeCodeAgentRunResult,
  ) {
    super(message);
    this.name = "ClaudeCodeAgentError";
  }
}

export async function runClaudeCodeAgent(
  options: ClaudeCodeAgentRunOptions,
): Promise<ClaudeCodeAgentRunResult> {
  const timeoutMs = options.timeoutMs ?? readAgentTimeoutMs(options.env ?? process.env);
  const runEnv = options.env ?? process.env;
  const command = options.command ?? runEnv.CARVIS_CLAUDECODE_BIN ?? "claude";
  const args = [...(options.args ?? [])];
  assertRealClaudeEnv(options, runEnv);
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: mergeClaudeCodeEnv(runEnv),
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
    void publishStream(options, chunk, "stdout");
  });

  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
    void publishStream(options, chunk, "stderr");
  });

  child.stdin.end(buildRolePrompt(options.role, options.prompt));

  const result = await new Promise<ClaudeCodeAgentRunResult>((resolve, reject) => {
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once("exit", (exitCode, signal) => {
      clearTimeout(timeout);
      resolve({
        pid: child.pid,
        stdout,
        stderr,
        exitCode,
        signal,
        timedOut,
      });
    });
  });

  if (result.timedOut) {
    throw new ClaudeCodeAgentError("agent_timeout", result);
  }

  if (result.exitCode !== 0) {
    throw new ClaudeCodeAgentError("agent_exit_nonzero", result);
  }

  return result;
}

function assertRealClaudeEnv(options: ClaudeCodeAgentRunOptions, env: NodeJS.ProcessEnv): void {
  if (options.command !== undefined) {
    return;
  }

  if (env.ANTHROPIC_AUTH_TOKEN === undefined || env.ANTHROPIC_AUTH_TOKEN.length === 0) {
    throw new Error("missing ANTHROPIC_AUTH_TOKEN for real Claude Code CLI mode");
  }
}

export function readAgentTimeoutMs(env: NodeJS.ProcessEnv): number {
  const value = env.CARVIS_AGENT_TIMEOUT_MS;

  if (value === undefined) {
    return 300_000;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 300_000;
  }

  return parsed;
}

function buildRolePrompt(role: AgentRole, prompt: string): string {
  return [
    `You are the Carvis ${role} Agent.`,
    "Work only within the assigned Carvis role boundary.",
    "Return concise, file-ready output.",
    "",
    prompt,
    "",
  ].join("\n");
}

async function publishStream(
  options: ClaudeCodeAgentRunOptions,
  text: string,
  stream: AgentOutputPayload["stream"],
): Promise<void> {
  if (options.bus === undefined || text.length === 0) {
    return;
  }

  await options.bus.publish<AgentOutputPayload>({
    type: "agent.output.stream",
    source: "claudecode",
    target: "electron",
    requestId: options.requestId,
    runId: options.runId,
    agentId: options.agentId ?? options.role,
    payload: {
      text,
      stream,
    },
  });
}
