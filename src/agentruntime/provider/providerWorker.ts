import { createInterface } from "node:readline";

import type { AgentRole } from "../../shared/types/agent.js";
import { ClaudeCodeWarmSdkAgent } from "../claudecode/warmSdk.js";
import { runClaudeCodePrint } from "../claudecode/command.js";
import { callArtistImageMcp, renderArtistImageMcpAssets } from "../mcp/artistImageMcp.js";
import { runDeepSeekOpenAiText } from "./deepseekOpenAi.js";
import { getRoleProviderConfig } from "./roles.js";
import { createProviderUsage, runQwenOpenAiText, type ProviderUsage } from "./qwenOpenAi.js";
import { runScraplingSearch } from "./scraplingSearch.js";

interface ProviderTaskInput {
  runId?: string;
  role: AgentRole;
  phase: string;
  commandText: string;
  speedMode?: "auto" | "fast" | "full";
  prompt: string;
  systemPrompt: string;
  outputRootPath?: string;
}

interface ProviderTaskResult {
  output: string;
  metadata: {
    provider: string;
    model: string;
    role: AgentRole;
    usage: ProviderUsage;
  };
}

const input = createInterface({
  input: process.stdin,
});
let sharedClaudeSessionId: string | undefined;
let sharedClaudeSessionRunId: string | undefined;

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
      output: result.output,
    });
    writeMessage({
      taskId: message.taskId,
      metadata: result.metadata,
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

async function runProviderTask(task: ProviderTaskInput, onProgress: (output: string) => void): Promise<ProviderTaskResult> {
  const config = getRoleProviderConfig(task.role);
  const canReuseClaudeSession = shouldReuseClaudeSession(task);

  if (task.runId !== undefined && sharedClaudeSessionRunId !== undefined && sharedClaudeSessionRunId !== task.runId) {
    sharedClaudeSessionId = undefined;
    sharedClaudeSessionRunId = undefined;
  }

  if (!canReuseClaudeSession) {
    sharedClaudeSessionId = undefined;
    sharedClaudeSessionRunId = undefined;
  }

  if (config.provider === "deepseek-claudecode") {
    onProgress(
      `provider:${task.role}: deepseek claude-code started model=${config.defaultModel} worker_pid=${process.pid}${
        canReuseClaudeSession && sharedClaudeSessionId !== undefined ? ` resume_session=${sharedClaudeSessionId}` : ""
      }`,
    );
    const output = await runDeepSeekClaudeCode(task, config.defaultModel, canReuseClaudeSession, onProgress);

    const usage = createProviderUsage(task.systemPrompt, task.prompt, output);

    return {
      output: [
      `PROVIDER: ${config.provider}`,
      `MODEL: ${config.defaultModel}`,
      `ROLE: ${task.role}`,
      "",
      output,
      ].join("\n"),
      metadata: {
        provider: config.provider,
        model: config.defaultModel,
        role: task.role,
        usage,
      },
    };
  }

  if (config.provider === "deepseek-openai") {
    onProgress(`provider:${task.role}: deepseek api started model=${config.defaultModel}`);
    const searchEvidence =
      task.role === "researcher" && task.speedMode !== "fast" && !isSimpleTask(task.commandText)
        ? await runScraplingSearch({
            commandText: task.commandText,
            env: process.env,
          })
        : {
            ok: false,
            evidenceText: "SCRAPLING_SEARCH_SKIPPED: fast/simple task",
          };
    if (task.role === "researcher") {
      onProgress(
        `provider:${task.role}: scrapling search ${searchEvidence.ok ? "finished" : "unavailable"} chars=${searchEvidence.evidenceText.length}`,
      );
    }
    const userPrompt =
      task.role === "researcher"
        ? [
            task.prompt,
            "",
            "## Scrapling Web Evidence",
            searchEvidence.evidenceText,
            "",
            "## Researcher source rules",
            "- 只能引用 Scrapling Web Evidence 中列出的 URL。",
            "- 如果证据没有给出精确播放量、互动数、发布日期或账号信息，必须写“未在公开证据中找到”，不能补造。",
            "- 可以给 engineer 提供 mock/fallback 数据结构，但必须标记为模拟数据。",
          ].join("\n")
        : task.prompt;
    const deepSeekResult = await runDeepSeekOpenAiText({
      model: config.defaultModel,
      systemPrompt: task.systemPrompt,
      userPrompt,
    });
    onProgress(`provider:${task.role}: deepseek api finished chars=${deepSeekResult.content.length}`);

    return {
      output: [
        `PROVIDER: ${config.provider}`,
        `MODEL: ${config.defaultModel}`,
        `ROLE: ${task.role}`,
        "",
        deepSeekResult.content,
      ].join("\n"),
      metadata: {
        provider: config.provider,
        model: config.defaultModel,
        role: task.role,
        usage: deepSeekResult.usage,
      },
    };
  }

  onProgress(`provider:${task.role}: qwen text started model=${config.defaultModel}`);
  const qwenResult = await runQwenOpenAiText({
    model: config.defaultModel,
    enableSearch:
      task.role === "researcher" &&
      task.speedMode !== "fast" &&
      !isSimpleTask(task.commandText) &&
      process.env.CARVIS_QWEN_RESEARCHER_SEARCH !== "0",
    forceSearch: task.role === "researcher" && task.speedMode !== "fast" && !isSimpleTask(task.commandText),
    systemPrompt: task.systemPrompt,
    userPrompt: task.prompt,
  });
  onProgress(`provider:${task.role}: qwen text finished chars=${qwenResult.content.length}`);
  const imageAssets =
    task.role === "artist" && shouldGenerateArtistImages(task.commandText, qwenResult.content, task.speedMode)
      ? await callArtistImageMcp({
          role: task.role,
          commandText: task.commandText,
          artistOutput: qwenResult.content,
          outputRootPath: task.outputRootPath,
          onProgress: (message) => {
            onProgress(`provider:${task.role}: ${message}`);
          },
        })
      : undefined;

  const renderedAssets = imageAssets === undefined ? "" : renderArtistImageMcpAssets(imageAssets);
  const output = [
    `PROVIDER: ${config.provider}`,
    `MODEL: ${config.defaultModel}`,
    `ROLE: ${task.role}`,
    "",
    qwenResult.content,
    renderedAssets,
  ].join("\n");

  return {
    output,
    metadata: {
      provider: config.provider,
      model: config.defaultModel,
      role: task.role,
      usage: {
        ...qwenResult.usage,
        completion_chars: qwenResult.usage.completion_chars + renderedAssets.length,
        total_chars: qwenResult.usage.total_chars + renderedAssets.length,
      },
    },
  };
}

async function runDeepSeekClaudeCode(
  task: ProviderTaskInput,
  model: string,
  canReuseClaudeSession: boolean,
  onProgress: (output: string) => void,
): Promise<string> {
  if (canReuseClaudeSession && process.env.CARVIS_CLAUDE_CODE_USE_SDK !== "0") {
    try {
      const agent = new ClaudeCodeWarmSdkAgent({
        env: {
          ...process.env,
          ANTHROPIC_MODEL: model,
        },
        cwd: process.cwd(),
        model,
        maxBudgetUsd: process.env.CARVIS_REAL_PROVIDER_MAX_BUDGET_USD ?? "0.20",
        timeoutMs: Number(process.env.CARVIS_REAL_PROVIDER_TIMEOUT_MS ?? 240_000),
        systemPrompt: task.systemPrompt,
        persistSession: canReuseClaudeSession,
        resume: canReuseClaudeSession ? sharedClaudeSessionId : undefined,
      });

      const result = await agent.query(task.prompt);
      agent.close();
      if (canReuseClaudeSession) {
        sharedClaudeSessionId = result.sessionId ?? sharedClaudeSessionId;
        sharedClaudeSessionRunId = task.runId;
      }
      onProgress(
        `provider:${task.role}: deepseek claude-code sdk finished session=${
          canReuseClaudeSession ? (sharedClaudeSessionId ?? "unknown") : "isolated"
        } worker_pid=${process.pid}`,
      );
      return result.output.trim();
    } catch (error) {
      if (process.env.CARVIS_CLAUDE_CODE_SDK_FALLBACK === "0") {
        throw error;
      }
      onProgress(
        `provider:${task.role}: deepseek claude-code sdk fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const result = await runClaudeCodePrint(task.prompt, {
    env: {
      ...process.env,
      ANTHROPIC_MODEL: model,
    },
    model,
    maxBudgetUsd: process.env.CARVIS_REAL_PROVIDER_MAX_BUDGET_USD ?? "0.20",
    timeoutMs: Number(process.env.CARVIS_REAL_PROVIDER_TIMEOUT_MS ?? 240_000),
    cwd: process.cwd(),
    systemPrompt: task.systemPrompt,
  });
  const output = result.stdout.trim();
  onProgress(`provider:${task.role}: deepseek claude-code print finished exit=${String(result.exitCode)} worker_pid=${process.pid}`);

  if (result.exitCode !== 0) {
    throw new Error(
      `DeepSeek Claude Code exited ${String(result.exitCode)} stdout=${output.slice(0, 600)} stderr=${result.stderr.trim().slice(0, 600)}`,
    );
  }

  return output;
}

function shouldReuseClaudeSession(task: ProviderTaskInput): boolean {
  const mode = task.speedMode ?? process.env.CARVIS_SPEED_MODE ?? "auto";

  return mode !== "fast" && !isSimpleTask(task.commandText);
}

function shouldGenerateArtistImages(
  commandText: string,
  artistOutput: string,
  speedMode: "auto" | "fast" | "full" | undefined,
): boolean {
  if (/不需要生图|不要生图|无需生图|禁止生图|不需要图片|不要图片/.test(commandText)) {
    return false;
  }
  const mode = speedMode ?? process.env.CARVIS_SPEED_MODE ?? "auto";
  if (mode === "fast") {
    return false;
  }
  if (mode !== "full" && isSimpleTask(commandText)) {
    return false;
  }
  if (mode === "auto") {
    return /图片|图像|生图|视觉|素材|游戏|game|HTML|html|网页|展示页|预览/i.test(commandText) ||
      /ARTIST_IMAGE_MCP_PLAN|assets|图片|image/i.test(artistOutput);
  }

  return true;
}

function isSimpleTask(commandText: string): boolean {
  const text = commandText.trim();

  return (text.length <= 80 || /一句话|简单|快速|验证|测试|只回复|不要生成文件|不用生成文件|无需生成文件/i.test(text)) &&
    !/图片|图像|生图|视觉|游戏|game|HTML|html|网页|展示页|预览/i.test(text);
}

function writeMessage(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
