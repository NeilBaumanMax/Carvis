import { createInterface } from "node:readline";

import type { AgentRole } from "../../shared/types/agent.js";
import { runClaudeCodePrint } from "../claudecode/command.js";
import { callArtistImageMcp, renderArtistImageMcpAssets } from "../mcp/artistImageMcp.js";
import { getRoleProviderConfig } from "./roles.js";
import { runQwenOpenAiText } from "./qwenOpenAi.js";

interface ProviderTaskInput {
  role: AgentRole;
  phase: string;
  commandText: string;
  prompt: string;
  systemPrompt: string;
  outputRootPath?: string;
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
    const result = await runProviderTask(task, (output) => {
      writeMessage({
        taskId: message.taskId,
        output,
      });
    });

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

async function runProviderTask(task: ProviderTaskInput, onProgress: (output: string) => void): Promise<string> {
  const config = getRoleProviderConfig(task.role);

  if (config.provider === "deepseek-claudecode") {
    onProgress(`provider:${task.role}: deepseek claude-code started model=${config.defaultModel}`);
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
    onProgress(`provider:${task.role}: deepseek claude-code finished exit=${String(result.exitCode)}`);

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

  onProgress(`provider:${task.role}: qwen text started model=${config.defaultModel}`);
  const qwenOutput = await runQwenOpenAiText({
    model: config.defaultModel,
    systemPrompt: task.systemPrompt,
    userPrompt: task.prompt,
  });
  onProgress(`provider:${task.role}: qwen text finished chars=${qwenOutput.length}`);
  const imageAssets =
    task.role === "artist" && shouldGenerateArtistImages(task.commandText, qwenOutput)
      ? await callArtistImageMcp({
          role: task.role,
          commandText: task.commandText,
          artistOutput: qwenOutput,
          outputRootPath: task.outputRootPath,
          onProgress: (message) => {
            onProgress(`provider:${task.role}: ${message}`);
          },
        })
      : undefined;

  return [
    `PROVIDER: ${config.provider}`,
    `MODEL: ${config.defaultModel}`,
    `ROLE: ${task.role}`,
    "",
    qwenOutput,
    imageAssets === undefined ? "" : renderArtistImageMcpAssets(imageAssets),
  ].join("\n");
}

function shouldGenerateArtistImages(commandText: string, artistOutput: string): boolean {
  if (/不需要生图|不要生图|无需生图|禁止生图|不需要图片|不要图片/.test(commandText)) {
    return false;
  }
  return true;
}

function writeMessage(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
