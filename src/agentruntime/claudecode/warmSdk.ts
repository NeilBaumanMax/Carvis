import { spawn } from "node:child_process";

import {
  startup,
  type Options as ClaudeAgentSdkOptions,
  type SDKMessage,
  type SpawnOptions,
  type SpawnedProcess,
  type WarmQuery,
} from "@anthropic-ai/claude-agent-sdk";

import { mergeClaudeCodeEnv } from "./deepseekClaudeCodeEnv.js";

export interface ClaudeCodeWarmSdkOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  model?: string;
  maxBudgetUsd?: string;
  timeoutMs?: number;
  systemPrompt?: string;
  initializeTimeoutMs?: number;
  persistSession?: boolean;
  resume?: string;
}

export interface ClaudeCodeWarmSdkResult {
  output: string;
  sessionId: string | undefined;
  exitReason: string;
  spawn: ClaudeCodeWarmSdkSpawn | undefined;
}

export interface ClaudeCodeWarmSdkSpawn {
  command: string;
  args: string[];
  pid: number | undefined;
}

export class ClaudeCodeWarmSdkAgent {
  private warm: WarmQuery | undefined;
  private lastSpawn: ClaudeCodeWarmSdkSpawn | undefined;
  private resumeSessionId: string | undefined;

  constructor(private readonly options: ClaudeCodeWarmSdkOptions = {}) {}

  get retained(): boolean {
    return this.warm !== undefined;
  }

  get pid(): number | undefined {
    return this.lastSpawn?.pid;
  }

  async warmup(): Promise<void> {
    if (this.warm !== undefined) {
      return;
    }

    this.warm = await startup({
      options: this.createSdkOptions(),
      initializeTimeoutMs: this.options.initializeTimeoutMs ?? 60_000,
    });
  }

  async query(prompt: string): Promise<ClaudeCodeWarmSdkResult> {
    await this.warmup();

    const warm = this.warm;

    if (warm === undefined) {
      throw new Error("Claude Code SDK warm query was not initialized");
    }

    this.warm = undefined;

    const query = warm.query(prompt);
    const querySpawn = this.lastSpawn;
    const result = await collectSdkResult(query, this.options.timeoutMs ?? 180_000);
    this.resumeSessionId = result.sessionId ?? this.resumeSessionId;

    await this.warmup();
    return {
      ...result,
      spawn: querySpawn,
    };
  }

  close(): void {
    this.warm?.close();
    this.warm = undefined;
  }

  private createSdkOptions(): ClaudeAgentSdkOptions {
    const env = this.options.env ?? process.env;
    const mergedEnv = mergeClaudeCodeEnv(env);
    const model = this.options.model ?? env.ANTHROPIC_MODEL ?? "deepseek-v4-flash";
    const maxBudgetUsd = Number(this.options.maxBudgetUsd ?? "0.20");
    const extraArgs: Record<string, string | null> = {};

    if (env.CARVIS_CLAUDE_CODE_BARE !== "0") {
      extraArgs.bare = null;
    }

    return {
      cwd: this.options.cwd,
      env: mergedEnv,
      model,
      maxBudgetUsd,
      systemPrompt:
        this.options.systemPrompt ??
        "You are a smoke test responder. Output exactly the requested text and nothing else.",
      tools: [],
      permissionMode: "dontAsk",
      persistSession: this.options.persistSession ?? false,
      resume: this.options.resume ?? this.resumeSessionId,
      pathToClaudeCodeExecutable: env.CARVIS_CLAUDE_CODE_BIN,
      extraArgs,
      spawnClaudeCodeProcess: (spawnOptions) => this.spawnClaudeCodeProcess(spawnOptions, env),
    };
  }

  private spawnClaudeCodeProcess(spawnOptions: SpawnOptions, env: NodeJS.ProcessEnv): SpawnedProcess {
    const runner = env.CARVIS_CLAUDE_CODE_RUNNER;
    const command = runner === undefined || runner.length === 0 ? spawnOptions.command : runner;
    const args =
      runner === undefined || runner.length === 0
        ? spawnOptions.args
        : [spawnOptions.command, ...spawnOptions.args];
    const child = spawn(command, args, {
      cwd: spawnOptions.cwd,
      env: spawnOptions.env,
      signal: spawnOptions.signal,
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stderr.on("data", () => {
      // stderr is consumed so Claude Code cannot block if it logs diagnostics.
    });
    this.lastSpawn = {
      command,
      args,
      pid: child.pid,
    };

    return child;
  }
}

async function collectSdkResult(
  query: AsyncIterable<SDKMessage>,
  timeoutMs: number,
): Promise<Omit<ClaudeCodeWarmSdkResult, "spawn">> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort(new Error(`claude sdk query timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  let output = "";
  let sessionId: string | undefined;
  let exitReason = "unknown";

  try {
    for await (const message of query) {
      if (abortController.signal.aborted) {
        throw abortController.signal.reason;
      }

      if ("session_id" in message && typeof message.session_id === "string") {
        sessionId = message.session_id;
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          output = message.result.trim();
          exitReason = message.stop_reason ?? "success";
        } else {
          throw new Error(`claude sdk result error: ${message.errors.join("; ")}`);
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  return {
    output,
    sessionId,
    exitReason,
  };
}
