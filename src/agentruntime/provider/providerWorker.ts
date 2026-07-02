import { createInterface } from "node:readline";

import type { AgentRole } from "../../shared/types/agent.js";
import { runClaudeCodePrint } from "../claudecode/command.js";
import { getRoleProviderConfig } from "./roles.js";
import { runQwenOpenAiText } from "./qwenOpenAi.js";

interface ProviderTaskInput {
  role: AgentRole;
  phase: string;
  commandText: string;
  prompt: string;
  systemPrompt: string;
}

const input = createInterface({
  input: process.stdin,
});

input.on("line", (line) => {
  void handleLine(line);
});

async function handleLine(line: string): Promise<void> {
  const message = JSON.parse(line) as {
    taskId?: string;
    input?: string;
    shutdown?: boolean;
  };

  if (message.shutdown === true) {
    process.exit(0);
  }

  if (message.taskId === undefined || message.input === undefined) {
    return;
  }

  try {
    const task = JSON.parse(message.input) as ProviderTaskInput;
    const result = await runProviderTask(task);

    writeMessage({
      taskId: message.taskId,
      output: result,
    });
    writeMessage({
      taskId: message.taskId,
      done: true,
    });
  } catch (error) {
    writeMessage({
      taskId: message.taskId,
      output: `PROVIDER_ERROR: ${error instanceof Error ? error.message : String(error)}`,
    });
    writeMessage({
      taskId: message.taskId,
      done: true,
    });
  }
}

async function runProviderTask(task: ProviderTaskInput): Promise<string> {
  const config = getRoleProviderConfig(task.role);

  if (config.provider === "deepseek-claudecode") {
    const result = await runClaudeCodePrint(task.prompt, {
      env: {
        ...process.env,
        ANTHROPIC_MODEL: config.defaultModel,
      },
      model: config.defaultModel,
      maxBudgetUsd: process.env.CARVIS_REAL_PROVIDER_MAX_BUDGET_USD ?? "0.20",
      timeoutMs: Number(process.env.CARVIS_REAL_PROVIDER_TIMEOUT_MS ?? 240_000),
      cwd: process.cwd(),
      systemPrompt: task.systemPrompt,
    });
    const output = result.stdout.trim();

    if (result.exitCode !== 0) {
      throw new Error(
        `DeepSeek Claude Code exited ${String(result.exitCode)} stdout=${output.slice(0, 600)} stderr=${result.stderr.trim().slice(0, 600)}`,
      );
    }

    return [
      `PROVIDER: ${config.provider}`,
      `MODEL: ${config.defaultModel}`,
      `ROLE: ${task.role}`,
      "",
      output,
    ].join("\n");
  }

  const qwenOutput = await runQwenOpenAiText({
    model: config.defaultModel,
    systemPrompt: task.systemPrompt,
    userPrompt: task.prompt,
  });

  return [
    `PROVIDER: ${config.provider}`,
    `MODEL: ${config.defaultModel}`,
    `ROLE: ${task.role}`,
    "",
    qwenOutput,
  ].join("\n");
}

function writeMessage(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
