import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createRemoteMessageBus } from "../messagebus/index.js";
import { writeOutput } from "../output/index.js";
import { runComponentMain } from "../shared/componentMain.js";
import type { AgentRole } from "../shared/types/agent.js";
import type { AgentOutputPayload } from "../shared/types/events.js";
import { createAgentRuntime } from "./index.js";
import { PersistentPidAgentPool } from "./pidagent/index.js";
import { getRoleProviderConfig } from "./provider/roles.js";
import { renderAgentSkillProgressLines } from "./skills/index.js";
import { ROLE_ORDER } from "./types.js";
import {
  createWorkplacePaths,
  initializeWorkplaces,
  readWorkplaceResults,
  writeManagerReview,
  writeWorkplaceResult,
} from "./workplaces/index.js";

const bus = createRemoteMessageBus({
  port: readPort(process.env.CARVIS_MESSAGEBUS_PORT),
});
const workplacesRoot = process.env.CARVIS_WORKPLACES_ROOT ?? join(process.cwd(), "workplaces", "runs");
const outputRoot = process.env.CARVIS_OUTPUT_ROOT ?? join("output", "runs");
const progressDelayMs = readNonNegativeInteger(process.env.CARVIS_AGENTRUNTIME_STREAM_DELAY_MS, 260);
const previewDelayMs = readNonNegativeInteger(process.env.CARVIS_AGENTRUNTIME_PREVIEW_DELAY_MS, 140);
const initializedRuns = new Set<string>();
const initializingRuns = new Map<string, Promise<void>>();
const runPaths = new Map<string, { workplacesRoot: string; outputRoot: string }>();
const providerPidAgentPool = isRealProviderMode() ? createProviderPidAgentPool() : undefined;
const runtime = createAgentRuntime(bus, {
  pidAgentPool: providerPidAgentPool,
  pidTaskTimeoutMs: readNonNegativeInteger(process.env.CARVIS_REAL_PROVIDER_TIMEOUT_MS, 240_000),
  pidTaskMaxAttempts: readNonNegativeInteger(process.env.CARVIS_REAL_PROVIDER_MAX_ATTEMPTS, 2),
  pidOutputValidator: isRealProviderMode() ? validateRealProviderOutput : undefined,
  engineerRunsAfterFailedReview:
    isRealProviderMode() && process.env.CARVIS_ENGINEER_RUNS_AFTER_FAILED_REVIEW !== "0",
  pidTaskInputBuilder: isRealProviderMode()
    ? async ({ run, agent, commandText, attempt, previousPidOutput, retryReason }) => {
        const paths = getRunPaths(run, commandText);
        await ensureRunInitialized(run.runId, paths.workplacesRoot, commandText);

        return JSON.stringify({
          role: agent.role,
          phase: run.phase,
          commandText,
          outputRootPath: paths.outputRoot,
          systemPrompt: createRoleSystemPrompt(agent.role, run.phase, commandText),
          prompt: await createRoleUserPrompt(paths.workplacesRoot, agent.role, run.phase, commandText, {
            attempt: attempt ?? 1,
            previousPidOutput,
            retryReason,
          }),
        });
      }
    : undefined,
  roleRunner: async ({ run, agent, commandText, pidOutput, pidMetadata }) => {
    const paths = getRunPaths(run, commandText);
    await ensureRunInitialized(run.runId, paths.workplacesRoot, commandText);

    const isManagerReview = agent.role === "manager" && run.phase === "manager_reviewing";
    const managerReview = isManagerReview
      ? isRealProviderMode() && pidOutput !== undefined
        ? parseManagerReview(pidOutput)
        : await renderManagerReviewResult(paths.workplacesRoot, commandText)
      : undefined;
    const roleResult =
      managerReview?.content ??
      (isRealProviderMode() && pidOutput !== undefined ? pidOutput : renderRoleResult(agent.role, commandText));

    if (!isRealProviderMode()) {
      await streamRoleProgress(run.requestId, run.runId, agent.agentId, agent.role, commandText, run.phase);
    }
    if (isManagerReview) {
      await writeManagerReview(paths.workplacesRoot, roleResult);
      await writeLayeredContextFiles(paths.workplacesRoot, agent.role, commandText, roleResult, "manager_review");
    } else {
      await writeWorkplaceResult(paths.workplacesRoot, agent.role, roleResult, pidMetadata);
      await writeLayeredContextFiles(paths.workplacesRoot, agent.role, commandText, roleResult, run.phase);
    }
    await streamRoleResultPreview(run.requestId, run.runId, agent.agentId, agent.role, roleResult);
    await publishRoleOutput(
      run.requestId,
      run.runId,
      agent.agentId,
      isManagerReview
        ? `Claude Code CLI public output: manager review gate written to ${join(paths.workplacesRoot, "manager", "review.md")}`
        : `Claude Code CLI public output: ${agent.role} result written to ${join(paths.workplacesRoot, agent.role, "result.md")}`,
    );
    if (managerReview !== undefined) {
      return {
        gatePassed: managerReview.gatePassed,
      };
    }
  },
  outputWriter: async ({ run, commandText }) => {
    const paths = getRunPaths(run, commandText);
    const results = await readWorkplaceResults(paths.workplacesRoot);

    return writeOutput({
      outputRootPath: paths.outputRoot,
      title: "Carvis Live Task Output",
      requireEngineerHtml: requiresEngineerHtml(commandText),
      workplaceResults: results.map((result) => ({
        role: result.role,
        sourcePath: result.resultPath,
        content: result.result,
      })),
    });
  },
});

function getRunPaths(run: { runId: string; requestId: string; createdAt: string }, commandText: string): { workplacesRoot: string; outputRoot: string } {
  const existing = runPaths.get(run.runId);

  if (existing !== undefined) {
    return existing;
  }

  const slug = createRunSlug(run.createdAt, run.requestId, commandText);
  const paths = {
    workplacesRoot: join(workplacesRoot, slug),
    outputRoot: join(outputRoot, slug),
  };

  runPaths.set(run.runId, paths);
  return paths;
}

async function ensureRunInitialized(runId: string, rootPath: string, commandText: string): Promise<void> {
  if (initializedRuns.has(runId)) {
    return;
  }

  const existing = initializingRuns.get(runId);
  if (existing !== undefined) {
    await existing;
    return;
  }

  const initializing = initializeWorkplaces(rootPath, commandText)
    .then(() => {
      initializedRuns.add(runId);
    })
    .finally(() => {
      initializingRuns.delete(runId);
    });

  initializingRuns.set(runId, initializing);
  await initializing;
}

function createRunSlug(createdAt: string, requestId: string, commandText: string): string {
  const timestamp = createdAt
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .replace(/\.\d+Z$/, "");
  const requestPart = safePathPart(requestId).slice(0, 36);
  const commandPart = safePathPart(commandText).slice(0, 32);

  return [timestamp, requestPart, commandPart].filter((part) => part.length > 0).join("-");
}

function safePathPart(value: string): string {
  return value
    .replace(/[\s/\\:*?"<>|]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

await runComponentMain({
  name: "agentruntime",
  onStart: () => {
    providerPidAgentPool?.prewarm(ROLE_ORDER);
    runtime.start();
    console.log("[agentruntime] connected to messagebus");
  },
  onShutdown: async () => {
    await runtime.shutdown();
    bus.close();
  },
});

function readPort(value: string | undefined): number {
  if (value === undefined) {
    return 45931;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isFinite(port) || port <= 0) {
    return 45931;
  }

  return port;
}

function readNonNegativeInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function isRealProviderMode(): boolean {
  return process.env.CARVIS_AGENTRUNTIME_REAL_PROVIDERS === "1";
}

function createProviderPidAgentPool(): PersistentPidAgentPool {
  return new PersistentPidAgentPool({
    createCommand: () => ({
      command: process.execPath,
      args: ["dist/agentruntime/provider/providerWorker.js"],
      env: process.env,
      cwd: process.cwd(),
    }),
  });
}

function createRoleSystemPrompt(role: AgentRole, phase: string, commandText: string): string {
  const provider = getRoleProviderConfig(role);
  const gameTask = isGameTask(commandText);
  const phaseLine =
    role === "manager" && phase === "manager_reviewing"
      ? "你现在是主管复审阶段。输出控制在 900 字内。只检查异常和阻塞；如果只是命名、尺寸、规则等可整合差异，给出极短统一意见并输出 GATE_PASSED: true。"
      : "你必须按本角色 skill 和上下游材料工作。";
  const roleLine =
    role === "manager"
      ? gameTask
        ? "manager 只写短任务合同和监控点，不超过 900 字：标明异常标准、PID/provider 失败恢复建议、writer/artist/researcher/engineer 的最小交付。不要做长篇复审。"
        : "manager 只写短任务合同和监控点，不超过 900 字：标明异常标准、PID/provider 失败恢复建议、信息结构/视觉/技术核验/HTML 集成的最小交付。不要做长篇复审。"
        : role === "writer"
          ? gameTask
          ? "writer 不能偷懒，但必须短交付：控制在 6000-9000 中文字以内，写具体人物、场景事件、中文对白、选择后果和结局文本，输出可直接被 engineer 数据化的内容，不写长篇设定书。"
          : "writer 不能偷懒，但必须短交付：控制在 6000-9000 中文字以内，把资料整理成准确中文说明、目录职责、关键文件用途和页面文案，输出可直接被 engineer 放入 HTML 的内容。"
        : role === "artist"
          ? gameTask
            ? "artist 以图片资产为主：文字要短，只写风格规则、资产清单、生成提示和自审，不要写长篇剧情。"
            : "artist 做信息展示视觉规划并默认产图：页面布局、配色、表格、流程图和可读性规则；轻量规划 1-4 张可嵌入 HTML 的 UI/图示资产，例如背景、目录图标、架构流程图、状态徽章，不要写长篇设定。"
          : role === "researcher"
            ? gameTask
              ? "researcher 必须把玩法拆成状态字段、数值表、反馈事件和可测试规则。"
              : "researcher 必须核验技术栈、目录职责、脚手架搭建流程、关键风险和可测试检查项。"
            : gameTask
              ? "engineer 必须把上游材料做成可玩的浏览器 HTML，并实际使用 artist 生成的本地图片资产。"
              : "engineer 必须把上游材料做成可浏览的中文 HTML 信息展示页，重点是结构准确、可读、可截图验收。";

  return [
    "你是 Carvis 多 Agent 系统中的一个真实工作进程。",
    `角色：${role}`,
    `Provider：${provider.provider}`,
    `Model：${provider.defaultModel}`,
    "输出语言必须是中文，技术文件名和必要 API 名可以保留英文。",
    "不要输出隐藏思考过程；只输出可公开的工作结果、检查清单、文件方案和必要代码。",
    "你不能调用工具、不能输出 <function_calls>、不能要求用户替你执行命令；你必须直接写出本角色的最终产物正文。",
    "必须紧贴用户原始任务，不得套用与任务无关的固定模板。",
    gameTask
      ? "这是游戏任务：最终必须推动生成可打开、可玩的 HTML/JS 预览，而不是只写设定。"
      : "这是非游戏任务：最终必须推动生成可打开的中文 HTML 展示页，而不是套用游戏模板。",
    roleLine,
    phaseLine,
  ].join("\n");
}

async function createRoleUserPrompt(
  currentWorkplacesRoot: string,
  role: AgentRole,
  phase: string,
  commandText: string,
  retry: {
    attempt: number;
    previousPidOutput?: string;
    retryReason?: string;
  },
): Promise<string> {
  const workplace = createWorkplacePaths(currentWorkplacesRoot, role);
  const input = await safeRead(workplace.inputPath);
  const plan = await safeRead(workplace.planPath);
  const commonRole = await safeRead(workplace.commonRolePath);
  const commonPolicy = await safeRead(workplace.commonPolicyPath);
  const selectedSkill = await safeRead(workplace.selectedSkillPath);
  const managerResult = await safeRead(createWorkplacePaths(currentWorkplacesRoot, "manager").resultPath);
  const managerReview = await safeRead(createWorkplacePaths(currentWorkplacesRoot, "manager").reviewPath);
  const writerResult = await safeRead(createWorkplacePaths(currentWorkplacesRoot, "writer").resultPath);
  const artistResult = await safeRead(createWorkplacePaths(currentWorkplacesRoot, "artist").resultPath);
  const researcherResult = await safeRead(createWorkplacePaths(currentWorkplacesRoot, "researcher").resultPath);
  const managerHandoff = await safeRead(createWorkplacePaths(currentWorkplacesRoot, "manager").handoffPath);
  const writerHandoff = await safeRead(createWorkplacePaths(currentWorkplacesRoot, "writer").handoffPath);
  const artistHandoff = await safeRead(createWorkplacePaths(currentWorkplacesRoot, "artist").handoffPath);
  const researcherHandoff = await safeRead(createWorkplacePaths(currentWorkplacesRoot, "researcher").handoffPath);
  const combinedTaskState = createCombinedTaskState(commandText, [
    managerHandoff,
    writerHandoff,
    artistHandoff,
    researcherHandoff,
  ]);

  const upstream =
    role === "manager" && phase === "manager_reviewing"
      ? [
          "## 员工产物待审核（压缩 handoff）",
          "### writer/handoff_to_engineer.json",
          compactHandoffForPrompt(writerHandoff),
          "### artist/handoff_to_engineer.json",
          compactHandoffForPrompt(artistHandoff),
          "### researcher/handoff_to_engineer.json",
          compactHandoffForPrompt(researcherHandoff),
          "",
          "## Artist 实际资产",
          ...createEngineerAssetLines(artistResult, [artistHandoff]),
          "",
          "## 复审输出硬要求",
          "- 逐条核对用户原始任务有没有被满足。",
          "- manager 主要检查异常：PROVIDER_ERROR、伪工具调用、空文件、明显偷懒、缺少本角色核心产物、与用户任务完全无关。",
          "- 如果 writer/artist/researcher 都有实质产物，但存在命名、画布尺寸、敌人数值、胜利条件等可整合差异，不要判返工；请给出“统一整合标准”交给 engineer。",
          "- 只有异常或缺失导致 engineer 无法继续时才输出 `GATE_PASSED: false`。",
          "- 需要修改但不阻断时，输出 `GATE_PASSED: true`，并列出 engineer 必须采用的修改意见。",
          "- 最后一行必须是 `GATE_PASSED: true` 或 `GATE_PASSED: false`。",
        ].join("\n")
      : role === "engineer"
        ? [
            "## Engineer implementation brief",
            ...createEngineerImplementationBrief(commandText, artistResult),
            "",
            "## Engineer task card（短上下文执行卡）",
            ...createEngineerTaskCard(commandText, combinedTaskState, artistResult),
            "",
            "## 本轮真实图片资产",
            ...createEngineerAssetLines(artistResult, [managerHandoff, writerHandoff, artistHandoff, researcherHandoff]),
            "",
            "## 分层 handoff_to_engineer.json（硬预算版）",
            "### manager",
            compactHandoffForPrompt(managerHandoff),
            "### writer",
            compactHandoffForPrompt(writerHandoff),
            "### artist",
            compactHandoffForPrompt(artistHandoff),
            "### researcher",
            compactHandoffForPrompt(researcherHandoff),
            "",
            "## 技术产出硬要求",
            ...createEngineerRequirements(commandText, artistResult),
          ].join("\n")
        : [
            "## 上游主管规则",
            summarizeRoleResult("manager", managerResult),
            "",
            "## 本角色工作要求",
            "- 必须引用用户原始任务中的题材、控制方式、素材要求和交付格式。",
            "- 必须输出足够 engineer 直接实现的材料。",
            role === "manager"
              ? "- 输出必须短：只写 task_type、版权边界、四个角色合同、MVP 验收清单、handoff_to_next；不要写长篇解释。"
              : "",
            role === "writer"
              ? "- 必须短交付：控制在 6000-9000 中文字以内；输出 scene/choice/ending 字段化材料，至少 4 个选择节点、每节点中文对白、选择后果和状态变化，故事性要强。"
              : "",
            role === "artist"
              ? isGameTask(commandText)
                ? "- 输出要短，重点给资产计划：2-4 个关键图片、用途、构图、UI 安全区和 prompt；真实 provider 会把图片资产追加到 GENERATED_IMAGE_ASSETS。"
                : "- 输出要短，重点给 HTML 信息展示视觉规划：布局、配色、表格/流程图、响应式和可读性；默认写轻量 ARTIST_IMAGE_MCP_PLAN，控制在 1-4 张可嵌入 HTML 的 UI/图示资产。"
              : "",
            role === "researcher"
              ? "- 必须输出状态字段、核心循环、数值表、反馈事件和 3 条 playtest 检查。"
              : "",
          ].join("\n");
  const retryBlock =
    retry.attempt > 1
      ? [
          "# 返工要求",
          `这是第 ${retry.attempt} 次尝试。上次输出没有通过系统质量门禁。`,
          `失败原因：${retry.retryReason ?? "未知"}`,
          "你必须直接重写完整产物，不要解释失败原因，不要输出工具调用。",
          "## 上次无效输出",
          retry.previousPidOutput ?? "",
          "",
        ].join("\n")
      : "";

  return [
    retryBlock,
    "# 用户原始任务",
    commandText,
    "",
    "# workplace/input.md",
    input,
    "",
    "# 本角色 common/role.md",
    commonRole,
    "",
    "# 本角色 common/policy.md",
    commonPolicy,
    "",
    "# 本角色 selected task skill",
    selectedSkill,
    "",
    "# 本角色 plan.md",
    plan,
    "",
    upstream,
  ].join("\n");
}

async function writeLayeredContextFiles(
  rootPath: string,
  role: AgentRole,
  commandText: string,
  result: string,
  phase: string,
): Promise<void> {
  const workplace = createWorkplacePaths(rootPath, role);
  const handoff = createRoleHandoff(role, result, commandText, phase);
  const evidence = createEvidenceIndex(role, result);
  const taskState = createTaskStateSnapshot(role, commandText, result, handoff);

  await writeFile(workplace.handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
  await writeFile(workplace.evidenceIndexPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(workplace.taskStatePath, `${JSON.stringify(taskState, null, 2)}\n`, "utf8");
}

function createRoleHandoff(role: AgentRole, result: string, commandText: string, phase: string): Record<string, unknown> {
  const taskType = classifyRuntimeTask(commandText);
  const lines = result
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const assets = extractAssetRefs(result);
  const headings = lines.filter((line) => /^#{1,4}\s+/.test(line)).slice(0, 24);
  const facts = extractRelevantLines(result, roleFactPatterns(role, taskType), 24);
  const decisions = extractRelevantLines(result, [/GATE_PASSED\s*:/i, /必须|统一|采用|范围|MVP|验收|结论|版权/i], 18);
  const constraints = extractRelevantLines(result, [/不得|禁止|不能|版权|边界|必须|验收|fallback|黑屏/i], 18);
  const risks = extractRelevantLines(result, [/风险|问题|失败|超时|缺失|不通过|待确认|冲突/i], 12);

  return {
    role,
    phase,
    task_type: taskType,
    facts: compactLines([...headings, ...facts], 24),
    decisions: compactLines(decisions, 16),
    assets,
    constraints: compactLines(constraints, 14),
    open_risks: compactLines(risks, 8),
    handoff_to_engineer: compactLines([...facts, ...decisions, ...assets.map((asset) => `asset:${asset}`)], 24),
  };
}

function createEvidenceIndex(role: AgentRole, result: string): Record<string, unknown> {
  const lines = result.split("\n");
  const entries = lines
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter((entry) =>
      /GATE_PASSED|assets\/|```html|状态|字段|物品|敌人|关卡|选择|结局|目录|文件|安装|启动/i.test(entry.text),
    )
    .slice(0, 80);

  return {
    role,
    entries,
  };
}

function createTaskStateSnapshot(
  role: AgentRole,
  commandText: string,
  result: string,
  handoff: Record<string, unknown>,
): Record<string, unknown> {
  const taskType = classifyRuntimeTask(commandText);

  return {
    task_type: taskType,
    source: `${role}/result.md`,
    must_have: extractRelevantLines(result, [/必须|至少|包含|验收|成功标准/i], 18),
    assets: extractAssetRefs(result),
    mechanics: extractRelevantLines(result, taskMechanicPatterns(taskType), 24),
    acceptance: extractRelevantLines(result, [/验收|检查|playtest|截图|浏览器|HTML|game-preview/i], 18),
    risks: extractRelevantLines(result, [/风险|失败|超时|黑屏|漂移|问题|冲突/i], 12),
    updated_by: [role],
    handoff_preview: handoff.handoff_to_engineer,
  };
}

function classifyRuntimeTask(commandText: string): string {
  if (/galgame|视觉小说|分支|选择|结局/i.test(commandText)) {
    return "galgame";
  }
  if (/闯关|平台|platform|跳跃|碰撞|wasd|方向键/i.test(commandText)) {
    return "platformer";
  }
  if (/bazaar|商店|自动战斗|物品组合|roguelike|构筑/i.test(commandText)) {
    return "shop-autobattler";
  }
  if (/github|仓库|脚手架|目录|文件用途|repo|README/i.test(commandText)) {
    return "repo-doc";
  }
  if (isGameTask(commandText)) {
    return "generic-game";
  }

  return "repo-doc";
}

function roleFactPatterns(role: AgentRole, taskType: string): RegExp[] {
  const rolePatterns: Record<AgentRole, RegExp[]> = {
    manager: [/task_type|任务|角色|验收|MVP|版权|边界|GATE_PASSED|统一/i],
    writer: [/角色|主角|场景|关卡|选择|对白|结局|物品|敌人|文案|章节|目录|页面/i],
    artist: [/assets\/|GENERATED_IMAGE_ASSETS|图片|标题|背景|角色|图标|配色|布局|安全区/i],
    researcher: [/状态|字段|循环|数值|物品|敌人|经济|战斗|碰撞|检查|命令|风险/i],
    engineer: [/```html|实现|文件|入口|测试|浏览器|game-preview|assets\//i],
  };

  return [...rolePatterns[role], ...taskMechanicPatterns(taskType)];
}

function taskMechanicPatterns(taskType: string): RegExp[] {
  if (taskType === "shop-autobattler") {
    return [/金币|商店|刷新|购买|出售|升级|合成|物品|敌人|自动战斗|战斗日志|声望|耐久|回合/i];
  }
  if (taskType === "platformer") {
    return [/移动|跳跃|碰撞|收集|敌人|巡逻|追捕|关卡|生命|重试|WASD|方向键/i];
  }
  if (taskType === "galgame") {
    return [/选择|场景|对白|结局|好感|状态|分支|旁白|角色/i];
  }
  if (taskType === "repo-doc") {
    return [/目录|文件|脚手架|安装|启动|依赖|架构|README|命令|风险/i];
  }

  return [/状态|循环|反馈|胜利|失败|素材|交互/i];
}

function extractRelevantLines(content: string, patterns: RegExp[], limit: number): string[] {
  return compactLines(
    content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && patterns.some((pattern) => pattern.test(line))),
    limit,
  );
}

function extractAssetRefs(content: string): string[] {
  return compactLines([...content.matchAll(/assets\/[\w.-]+\.(?:png|jpg|jpeg|webp|svg)/gi)].map((match) => match[0]), 24);
}

function extractActualArtistAssetRefs(content: string): string[] {
  const refs = [...content.matchAll(/(?:output\/runs\/[^\s`"'<>]+\/)?assets\/(artist-[\w.-]+\.(?:png|jpg|jpeg|webp))/gi)]
    .map((match) => `assets/${match[1]}`)
    .filter((asset) => !/assets\/(?:title|scene|city|rooftop|level|ending)[\w.-]*\.(?:png|jpg|jpeg|webp)$/i.test(asset));

  return compactLines(refs, 24);
}

function compactLines(lines: string[], limit: number): string[] {
  return compactLinesWithMaxChars(lines, limit, 220);
}

function compactLinesForPrompt(lines: string[], limit: number): string[] {
  return compactLinesWithMaxChars(lines, limit, 150);
}

function compactLinesWithMaxChars(lines: string[], limit: number, maxChars: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const line of lines) {
    const key = line.trim();
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(key.length > maxChars ? `${key.slice(0, maxChars - 3)}...` : key);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function compactJsonText(content: string, maxChars: number): string {
  const trimmed = content.trim();

  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const compact = JSON.stringify(parsed, null, 2);

    return compact.slice(0, maxChars);
  } catch {
    return trimmed.slice(0, maxChars);
  }
}

function createCombinedTaskState(commandText: string, handoffTexts: string[]): Record<string, unknown> {
  const parsed = handoffTexts
    .map((text) => parseJsonObject(text))
    .filter((value): value is Record<string, unknown> => value !== undefined);

  return {
    task_type: classifyRuntimeTask(commandText),
    source: "combined_layered_handoff",
    facts: mergeArrayFieldsForPrompt(parsed, "facts", 6),
    decisions: mergeArrayFieldsForPrompt(parsed, "decisions", 5),
    assets: mergeArrayFieldsForPrompt(parsed, "assets", 12),
    constraints: mergeArrayFieldsForPrompt(parsed, "constraints", 4),
    open_risks: mergeArrayFieldsForPrompt(parsed, "open_risks", 2),
    handoff_to_engineer: mergeArrayFieldsForPrompt(parsed, "handoff_to_engineer", 10),
  };
}

function parseJsonObject(content: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(content);

    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function mergeArrayFields(objects: Record<string, unknown>[], field: string, limit: number): string[] {
  return compactLines(
    objects.flatMap((object) => {
      const value = object[field];

      return Array.isArray(value) ? value.map((item) => String(item)) : [];
    }),
    limit,
  );
}

function mergeArrayFieldsForPrompt(objects: Record<string, unknown>[], field: string, limit: number): string[] {
  return compactLinesForPrompt(
    objects.flatMap((object) => {
      const value = object[field];

      return Array.isArray(value) ? value.map((item) => String(item)) : [];
    }),
    limit,
  );
}

function validateRealProviderOutput({
  agent,
  run,
  commandText,
  pidOutput,
}: {
  agent: { role: AgentRole };
  run: { phase: string };
  commandText: string;
  pidOutput?: string;
}): { ok: boolean; reason?: string } {
  const output = pidOutput?.trim() ?? "";
  const normalized = output.toLowerCase();
  const isManagerReview = agent.role === "manager" && run.phase === "manager_reviewing";
  const gameTask = isGameTask(commandText);

  if (output.length === 0) {
    return { ok: false, reason: "输出为空" };
  }
  if (/^PROVIDER_ERROR:/m.test(output)) {
    return { ok: false, reason: "provider 调用失败" };
  }
  if (output.includes("<function_calls>") || output.includes("<invoke name=") || normalized.includes("workplace目录不存在")) {
    return { ok: false, reason: "输出了伪工具调用或目录检查，而不是角色产物" };
  }
  if (!output.includes("PROVIDER:") && isRealProviderMode()) {
    return { ok: false, reason: "缺少 provider 标记，输出协议异常" };
  }

  const minLength = isManagerReview ? 500 : agent.role === "manager" ? 700 : agent.role === "engineer" ? 2_500 : 1_800;
  if (output.length < minLength) {
    return { ok: false, reason: `产物过短：${output.length} 字节，低于 ${minLength}` };
  }
  if (isManagerReview && !/gate_passed\s*:\s*(true|false)/i.test(output)) {
    return { ok: false, reason: "manager 复审缺少 GATE_PASSED 标记" };
  }
  if (agent.role === "engineer" && gameTask && !/```html[\s\S]*<\/html>\s*```/i.test(output)) {
    return { ok: false, reason: "engineer 没有输出完整 fenced HTML 游戏文件" };
  }
  if (agent.role === "engineer") {
    const html = extractHtmlFromProviderOutput(output);
    const htmlValidation = html === undefined ? { ok: false, reason: "engineer HTML 提取失败" } : validateHtmlScripts(html);
    if (!htmlValidation.ok) {
      return { ok: false, reason: htmlValidation.reason };
    }
  }

  return { ok: true };
}

function extractHtmlFromProviderOutput(output: string): string | undefined {
  const fencedMatch = /```html\s*([\s\S]*?<\/html>)\s*```/i.exec(output);
  const rawMatch = /<!doctype html[\s\S]*<\/html>/i.exec(output) ?? /<html[\s\S]*<\/html>/i.exec(output);

  return fencedMatch?.[1] ?? rawMatch?.[0];
}

function validateHtmlScripts(html: string): { ok: boolean; reason?: string } {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1] ?? "");

  for (const [index, script] of scripts.entries()) {
    try {
      new Function(script);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return { ok: false, reason: `engineer HTML script ${index + 1} 语法错误：${message}` };
    }
  }

  return { ok: true };
}

function parseManagerReview(output: string): { content: string; gatePassed: boolean } {
  const normalized = output.toLowerCase();
  const explicitFalse = /gate_passed\s*:\s*false/i.test(output);
  const explicitTrue = /gate_passed\s*:\s*true/i.test(output);
  const hasRework = output.includes("返工") || output.includes("不通过") || normalized.includes("rework");

  return {
    content: output,
    gatePassed: explicitFalse ? false : explicitTrue ? true : !hasRework,
  };
}

function isGameTask(commandText: string): boolean {
  return /游戏|game|rpg|galgame|杀戮尖塔|卡牌|平台|关卡|wasd|j\/k\/l/i.test(commandText);
}

function requiresEngineerHtml(commandText: string): boolean {
  return isGameTask(commandText) || /game-preview\.html|HTML|html|浏览器|展示页|预览窗口/i.test(commandText);
}

function createEngineerAssetLines(artistResult: string, handoffTexts: string[]): string[] {
  const assets = compactLinesForPrompt(
    [
      ...extractActualArtistAssetRefs(artistResult),
      ...handoffTexts.flatMap((text) => extractActualArtistAssetRefs(text)),
    ].map((asset) => `- ${asset}`),
    12,
  );

  return assets.length > 0
    ? [
        "- 下列路径来自本轮 Artist 实际生成记录，HTML 必须至少引用其中 2 个；标题页和一个可玩场景都要明显显示图片。",
        "- 禁止引用未列入此清单的虚拟图片名，例如 assets/title-bg.png、assets/scene-city.png、assets/scene-rooftop.png。",
        ...assets,
      ]
    : [
        "- 未发现本轮 Artist 图片路径；HTML 必须用 CSS/Canvas/SVG 生成可见画面，并提供图片缺失 fallback。",
    ];
}

function createEngineerTaskCard(
  commandText: string,
  combinedTaskState: Record<string, unknown>,
  artistResult: string,
): string[] {
  const taskType = String(combinedTaskState.task_type ?? classifyRuntimeTask(commandText));
  const assets = compactLinesForPrompt(extractActualArtistAssetRefs(artistResult), 8);
  const decisions = Array.isArray(combinedTaskState.decisions)
    ? compactLinesForPrompt(combinedTaskState.decisions.map(String), 5)
    : [];
  const handoff = Array.isArray(combinedTaskState.handoff_to_engineer)
    ? compactLinesForPrompt(combinedTaskState.handoff_to_engineer.map(String), 8)
    : [];

  return [
    `- task_type: ${taskType}`,
    "- 目标：直接输出一个完整 fenced HTML，能保存为本轮 output/runs/.../game-preview.html 并在浏览器打开。",
    isGameTask(commandText)
      ? "- 游戏最小切片：标题页、状态栏、4 个选择节点、即时状态变化、3 个结局、重开按钮。"
      : "- 文档最小切片：概览、结构图、目录职责表、脚手架流程、关键风险、数据来源说明。",
    "- 叙事/内容不足时：基于用户原始任务和 handoff 自行补齐短文本，不要等待更多上游材料。",
            "- 冲突处理：Engineer 自己做集成审核；优先用户原始任务，其次 manager 监控摘要、researcher 数值、writer 文案、artist 实际资产。",
    "- 资产处理：只允许使用下方 asset 行列出的本轮真实图片路径，不要使用 writer/researcher 建议的虚拟文件名。",
    ...decisions.map((line) => `- decision: ${line}`),
    ...handoff.map((line) => `- handoff: ${line}`),
    ...assets.map((asset) => `- asset: ${asset}`),
  ];
}

function compactHandoffForPrompt(content: string): string {
  const parsed = parseJsonObject(content);

  if (parsed === undefined) {
    return compactJsonText(content, 700);
  }

  const promptHandoff = {
    role: parsed.role,
    task_type: parsed.task_type,
    decisions: Array.isArray(parsed.decisions) ? compactLinesForPrompt(parsed.decisions.map(String), 3) : [],
    assets: compactLinesForPrompt(extractActualArtistAssetRefs(content), 6),
    constraints: Array.isArray(parsed.constraints) ? compactLinesForPrompt(parsed.constraints.map(String), 2) : [],
    handoff_to_engineer: Array.isArray(parsed.handoff_to_engineer)
      ? compactLinesForPrompt(parsed.handoff_to_engineer.map(String), 5)
      : [],
  };

  return JSON.stringify(promptHandoff, null, 2);
}

function createEngineerFallbackExcerpt(
  managerResult: string,
  managerReview: string,
  writerResult: string,
  artistResult: string,
  researcherResult: string,
  commandText: string,
): string {
  const managerSections = createEngineerManagerSections(managerResult, managerReview, commandText).join("\n").slice(0, 900);
  const excerpts = [
    managerSections,
    "### writer essentials",
    summarizeRoleResultForEngineer("writer", writerResult, commandText).slice(0, 1_000),
    "### artist essentials",
    summarizeRoleResultForEngineer("artist", artistResult, commandText).slice(0, 700),
    "### researcher essentials",
    summarizeRoleResultForEngineer("researcher", researcherResult, commandText).slice(0, 1_000),
  ];

  return excerpts.join("\n");
}

function createEngineerRequirements(commandText: string, artistResult: string): string[] {
  const base = [
    "- 你必须自己完成集成审核：只要 writer/artist/researcher 有实质产物，就整合可用部分继续生产；不要等待 manager 复审。",
    "- 如果上游命名、数值、资产建议冲突，按用户任务和本轮真实 artist assets 统一，不要打回。",
    "- 必须输出一个完整的单文件 HTML，使用 fenced code block：```html ... ```。",
    "- HTML 必须可直接保存为 output/game-preview.html 并在浏览器打开。",
  ];

  if (!isGameTask(commandText)) {
    return [
      ...base,
      "- 这是文档/分析展示任务：必须把上游材料集成为准确、可读、可截图验收的信息展示 HTML，不得套用游戏剧情、关卡、结局模板。",
      "- 必须包含：概览、目录职责表、脚手架搭建流程、关键文件说明、数据来源说明。",
      "- 需要使用 CSS/HTML 做清晰的信息架构；可以使用表格、时间线、流程图、目录树和筛选标签。",
      "- 如果 artist 产物包含图片资产，可以作为装饰或图示使用；如果没有图片资产，不得伪造资产路径。",
    ];
  }

  return [
    ...base,
    "- 必须把上游内容集成为真实可玩游戏产物，不得只写方案。",
    "- 标题页和至少一个可玩场景必须明显使用 artist 生成的本地图片；如果图片加载失败才允许 CSS/Canvas fallback。",
    "- 首屏截图不得是黑屏：标题文字、开始按钮/提示、背景图三者必须同时可见。",
    "- 如果用户要求 WASD/JKL/鼠标/触屏等控制，必须明确实现。",
    "- 如果用户要求 WASD/JKL/鼠标/触屏等控制，HTML 代码内必须实现对应事件。",
    "- 必须用 Canvas/SVG/CSS 代码生成素材或明确嵌入素材，不得只写美术氛围。",
    artistResult.includes("GENERATED_IMAGE_ASSETS")
      ? "- 如果 artist/result.md 包含 GENERATED_IMAGE_ASSETS，必须在 HTML 中使用这些本地图片资产；从 output/game-preview.html 引用时使用相对路径 assets/文件名。"
      : "- 如果没有 artist 图片资产，必须用 Canvas/SVG/CSS 生成明确可见的游戏画面素材。",
  ];
}

function createEngineerImplementationBrief(commandText: string, artistResult: string): string[] {
  const lines = [
    "- 先做最小完整可玩 HTML，再补视觉和文案；不要复述上游报告。",
    "- 所有数据优先写成短数组/对象，所有交互必须能在一个浏览器页面内完成。",
    "- 页面必须避免黑屏：图片加载失败时也要有 CSS/Canvas fallback 和可点击按钮。",
    "- 首屏必须肉眼可见：显示标题、开始按钮/提示、至少一张本轮图片；不要只渲染黑色背景和状态栏。",
    "- 图片优先用 `<img>` 绝对铺底或可验证的背景层，设置 `object-fit: cover`、明确 z-index，并确保遮罩透明度不会盖黑画面。",
    "- 脚本放在一个闭包或模块化对象里，避免全局变量重复声明。",
  ];

  if (/商店|自动战斗|roguelike|Bazaar|The Bazaar/i.test(commandText)) {
    lines.push(
      "- 商店/自动战斗任务最小切片：8-12 个物品、3 个敌人、一个商店刷新池、一个物品栏、一个自动战斗循环、战斗日志、下一天、重开。",
      "- 必须实现购买、刷新、升级或合成、出售、开始战斗、胜负结算；不要只做物品展示页。",
      "- HUD 至少展示金币、天数、飞艇耐久或生命、声望/热度。",
    );
  }

  if (/assets\/[\w.-]+\.(?:png|jpg|jpeg|webp|svg)/i.test(artistResult)) {
    lines.push("- 必须引用 artist 本次实际生成的 `assets/...` 相对路径，不要自造图片文件名。");
  }

  return lines;
}

function createEngineerManagerSections(managerResult: string, managerReview: string, commandText: string): string[] {
  const review = managerReview.trim();
  const hasUsableReview = review.length > 0 && !/Pending result/i.test(review);

  return hasUsableReview
    ? ["### manager/review.md", summarizeRoleResultForEngineer("manager", managerReview, commandText)]
    : ["### manager/result.md", summarizeRoleResultForEngineer("manager", managerResult, commandText)];
}

function summarizeRoleResult(role: AgentRole, content: string): string {
  const trimmed = content.trim();

  if (trimmed.length <= 8_000) {
    return trimmed;
  }

  const blocks = [
    extractProviderHeader(trimmed),
    extractMatchingLines(trimmed, [
      /^#{1,4}\s+/,
      /GATE_PASSED\s*:/i,
      /GENERATED_IMAGE_ASSETS/i,
      /ARTIST_IMAGE_MCP_SELF_REVIEW/i,
      /state_schema/i,
      /ending_rules/i,
      /determineEnding/i,
      /sceneId|choiceId|endingId|stateChanges/i,
      /assets\/[\w.-]+\.png/i,
      /```(?:html|javascript|js|json)?/i,
    ]),
    extractCodeBlocks(trimmed, role === "engineer" ? 24_000 : 10_000),
    tail(trimmed, 2_000),
  ].filter((part) => part.length > 0);

  return [
    `<!-- ${role} result compressed from ${trimmed.length} chars for downstream handoff -->`,
    dedupeLines(blocks.join("\n\n")).slice(0, role === "manager" ? 6_000 : 8_000),
  ].join("\n");
}

function summarizeRoleResultForEngineer(role: AgentRole, content: string, commandText: string): string {
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return "";
  }

  const gameTask = isGameTask(commandText);
  const rolePatterns: Record<AgentRole, RegExp[]> = {
    manager: [
      /GATE_PASSED\s*:/i,
      /统一整合标准|最终验收|必做|阻塞|文件名|assets\/[\w.-]+\.png/i,
      /标题页|商店|自动战斗|第\s*\d+\s*关|关卡|胜利|失败|版权边界/i,
    ],
    writer: gameTask
      ? [
          /游戏名|主角|反派|同伴|第\s*\d+\s*关|关卡|目标|阻碍|对白|过关|失败|结局|ending|scene|dialogue/i,
          /物品|商品|价格|触发|效果|风味|金币|商店|刷新|升级|出售|自动战斗|战斗日志|敌人|竞争者|声望|耐久|回合|护盾|伤害|地点|传闻/i,
        ]
      : [/概览|目录|文件|用途|流程|步骤|风险|表格|展示/i, /```(?:json)?/i],
    artist: [
      /GENERATED_IMAGE_ASSETS|ARTIST_IMAGE_MCP_SELF_REVIEW|生成数量/i,
      /assets\/[\w.-]+\.(?:png|jpg|jpeg|webp|svg)/i,
      /标题|背景|关卡|结局|主视觉|布局|配色|安全区|style|palette/i,
    ],
    researcher: gameTask
      ? [
          /PlayerState|GameState|EntityState|ITEM_DB|ENEMY_DB|状态|字段|核心循环|数值|碰撞|胜利|失败|playtest|检查/i,
          /金币|声望|热度|耐久|商店|刷新|升级|合成|出售|槽位|触发|回合|自动战斗|战斗日志|护盾|伤害|敌人|奖励|惩罚|移动|跳跃|互动|收集|生命/i,
        ]
      : [/技术栈|脚手架|目录|文件|依赖|命令|风险|检查项|搭建/i],
    engineer: [/```html/i],
  };
  const maxChars: Record<AgentRole, number> = {
    manager: 1_600,
    writer: 2_400,
    artist: 1_800,
    researcher: 2_400,
    engineer: 8_000,
  };
  const parts = [
    extractProviderHeader(trimmed),
    extractMatchingLines(trimmed, rolePatterns[role]),
  ].filter((part) => part.length > 0);
  const summary = dedupeLines(parts.join("\n\n")).slice(0, maxChars[role]);

  return [
    `<!-- ${role} engineer handoff compressed from ${trimmed.length} chars -->`,
    summary.length > 0 ? summary : tail(trimmed, maxChars[role]),
  ].join("\n");
}

function extractProviderHeader(content: string): string {
  return content
    .split("\n")
    .filter((line) => /^(# Result|PROVIDER:|MODEL:|ROLE:|provider:)/.test(line))
    .slice(0, 12)
    .join("\n");
}

function extractMatchingLines(content: string, patterns: RegExp[]): string {
  return content
    .split("\n")
    .filter((line) => patterns.some((pattern) => pattern.test(line)))
    .slice(0, 120)
    .join("\n");
}

function extractCodeBlocks(content: string, maxChars: number): string {
  const matches = [...content.matchAll(/```[\s\S]*?```/g)].map((match) => match[0]);

  return matches.join("\n\n").slice(0, maxChars);
}

function tail(content: string, maxChars: number): string {
  return content.slice(Math.max(0, content.length - maxChars));
}

function dedupeLines(content: string): string {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const line of content.split("\n")) {
    const key = line.trim();
    if (key.length > 0 && seen.has(key)) {
      continue;
    }
    if (key.length > 0) {
      seen.add(key);
    }
    lines.push(line);
  }

  return lines.join("\n");
}

async function safeRead(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function streamRoleProgress(
  requestId: string,
  runId: string,
  agentId: string,
  role: string,
  commandText: string,
  phase: string,
): Promise<void> {
  for (const line of createPublicProgressLines(role, commandText, phase)) {
    await publishRoleOutput(requestId, runId, agentId, line);
    await sleep(progressDelayMs);
  }
}

async function streamRoleResultPreview(
  requestId: string,
  runId: string,
  agentId: string,
  role: string,
  result: string,
): Promise<void> {
  const prefix = `>>> RESULT PREVIEW [${role.toUpperCase()}]`;
  const lines = result
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(0, 18);

  await publishRoleOutput(requestId, runId, agentId, `${prefix} generated ${lines.length} visible design lines`);
  for (const line of lines) {
    await publishRoleOutput(requestId, runId, agentId, `${prefix} ${line}`);
    await sleep(previewDelayMs);
  }
}

async function publishRoleOutput(
  requestId: string,
  runId: string,
  agentId: string,
  text: string,
): Promise<void> {
  await bus.publish<AgentOutputPayload>({
    type: "agent.output",
    source: "agentruntime",
    target: "electron",
    requestId,
    runId,
    agentId,
    payload: {
      stream: "stdout",
      text,
    },
  });
}

function createPublicProgressLines(role: string, commandText: string, phase: string): string[] {
  const prefix = `>>> LIVE CLI STREAM [${role.toUpperCase()}]`;
  const profile = roleProfile(role);
  const isManagerReview = role === "manager" && phase === "manager_reviewing";
  const skillLines = isKnownRole(role)
    ? renderAgentSkillProgressLines(role).map((line) => `${prefix} ${line}`)
    : [];
  const adaptationMode = isDonQuixoteTask(commandText)
    ? "公版作品改编"
    : isBuriedGiantTask(commandText)
      ? "受主题启发的原创 RPG；不得复制受保护角色、情节、地名和独特设定"
      : isGreenWaterMonsterTask(commandText)
        ? "受主题气质启发的原创 galgame；不得复制受保护角色、情节和独特表达"
        : isDeckTowerTask(commandText)
          ? "原创爬塔卡牌 roguelike；不得复制既有游戏角色、卡牌、遗物、美术和 UI"
          : "文学 RPG 改编；执行版权安全检查";

  return [
    `${prefix} 人设=${profile.name}`,
    `${prefix} 分工=${profile.specialty}`,
    `${prefix} 口吻约束=${profile.voice}`,
    `${prefix} 输出语言=中文；除必要文件名/技术名词外不要输出英文说明`,
    ...(isManagerReview
      ? [
          `${prefix} 当前阶段=主管复审；正在检查 writer/artist/researcher 是否达标`,
          `${prefix} 审核规则=未达标或偷懒不得交给 engineer 制作`,
        ]
      : []),
    ...skillLines,
    `${prefix} 已收到 Electron 输入框任务`,
    `${prefix} 改编模式=${adaptationMode}`,
    `${prefix} 正在阅读任务：${commandText.slice(0, 96)}`,
    `${prefix} 正在建立本角色检查清单`,
    `${prefix} 正在读取本角色 workplace/skill.md 和 plan.md`,
    `${prefix} 需要引用其他角色输入，输出具体游戏设计，不只输出状态`,
    `${prefix} 正在为 ${role} 生成中文 RPG 内容`,
    `${prefix} 正在补充章节、机制、循环和 MVP 任务`,
    `${prefix} 正在写入 workplace/result.md`,
    `${prefix} 正在把生成结果预览流式写回本面板`,
  ];
}

function isKnownRole(role: string): role is "manager" | "writer" | "artist" | "researcher" | "engineer" {
  return ["manager", "writer", "artist", "researcher", "engineer"].includes(role);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function renderRoleResult(role: string, commandText: string): string {
  if (isDonQuixoteTask(commandText)) {
    return renderDonQuixoteRoleResult(role, commandText);
  }
  if (isBuriedGiantTask(commandText)) {
    return renderBuriedGiantInspiredRoleResult(role, commandText);
  }
  if (isGreenWaterMonsterTask(commandText)) {
    return renderGreenWaterMonsterInspiredRoleResult(role, commandText);
  }
  if (isDeckTowerTask(commandText)) {
    return renderDeckTowerRoleResult(role, commandText);
  }
  if (isMacbethTask(commandText)) {
    return renderMacbethRoleResult(role, commandText);
  }

  switch (role) {
    case "manager":
      return [
        "## Manager Plan",
        "",
        `Task: ${commandText}`,
        "",
        "- Scope the game as an original literary dark-fantasy RPG about memory, aging, buried history, and reconciliation.",
        "- Avoid using protected plot, characters, locations, or unique expressions from the source novel.",
        "- Deliver a playable MVP around one village hub, one misted road, one ruin, and a final memory trial.",
      ].join("\n");
    case "writer":
      return [
        "## Writer Narrative",
        "",
        "Working title: Veil of Ash and Heather.",
        "",
        "The player guides two aging wanderers through a valley where a pale mist softens personal memory and public guilt. Villagers prefer peace bought by forgetting, while old songs, scars, and ruined stones insist that something terrible was buried rather than healed.",
        "",
        "The story should center on choices: recover memories and risk renewed hatred, or preserve forgetting and lose identity. The final act asks whether truth must be carried as judgment, mourning, or a promise to rebuild.",
      ].join("\n");
    case "artist":
      return [
        "## Artist Direction",
        "",
        "- Visual tone: muted greens, wet stone, ash-gray skies, warm lantern interiors.",
        "- Characters: weathered travelers, guarded villagers, silent memorial keepers, masked oath-breakers.",
        "- UI motif: a fraying tapestry map where restored memories stitch new threads into old blank spaces.",
        "- Key scenes: fog road, abandoned causeway, giant barrow-like hill, ruined watchtower, twilight river crossing.",
      ].join("\n");
    case "researcher":
      return [
        "## Researcher Systems",
        "",
        "- Memory meter: remembering unlocks truth, dialogue, and hidden paths; forgetting lowers conflict and avoids some fights.",
        "- Bond meter: companions can disagree about whether a memory should be restored.",
        "- Exploration loop: talk, inspect relics, solve memory echoes, choose what to record in the party journal.",
        "- Combat loop: low-frequency tactical encounters against grief-forms, oath-shades, and fear-born guardians.",
      ].join("\n");
    case "engineer":
      return [
        "## Engineer MVP Build List",
        "",
        "1. Hub village with 6 NPCs, dialogue flags, and one memory choice.",
        "2. Misted road exploration map with three relic interactions.",
        "3. Turn-based combat prototype: two party members, three enemy types, guard/appeal/strike actions.",
        "4. Memory journal UI that stores recovered, refused, and distorted memories.",
        "5. Three chapter quests:",
        "   - The Empty Feast: restore or suppress a village betrayal memory.",
        "   - Stones Under Moss: uncover why a road was abandoned.",
        "   - The Hill That Breathes: decide what truth reaches the valley.",
        "6. Endings:",
        "   - Mercy of Mist: peace remains, identity fades.",
        "   - Burden of Names: truth returns, conflict resumes, repair begins.",
        "   - Shared Vigil: partial truth becomes ritual mourning instead of revenge.",
      ].join("\n");
    default:
      return `Completed ${role}: ${commandText}`;
  }
}

async function renderManagerReviewResult(
  currentWorkplacesRoot: string,
  commandText: string,
): Promise<{ content: string; gatePassed: boolean }> {
  const results = await readWorkplaceResults(currentWorkplacesRoot);
  const employeeRoles = ["writer", "artist", "researcher"] as const;
  const employeeResults = employeeRoles.map((role) => {
    const result = results.find((item) => item.role === role);
    return {
      role,
      content: result?.result ?? "",
    };
  });
  const auditRows = employeeResults.map(({ role, content }) => {
    const visibleContent = content.replace(/^# Result\s*/i, "").trim();
    const lowerContent = visibleContent.toLowerCase();
    const hasRoleDetail =
      role === "writer"
        ? /任务|章节|选择|后果|结局|quest|choice|ending|chapter/.test(lowerContent)
        : role === "artist"
          ? /资产|视觉|ui|场景|角色|色彩|asset|visual|scene|palette|animation/.test(lowerContent)
          : /机制|循环|数值|状态|战斗|平衡|loop|meter|combat|balance|system/.test(lowerContent);
    const hasEnoughWork = visibleContent.length >= 240;
    const status = hasRoleDetail && hasEnoughWork ? "通过" : "返工";
    const reason = status === "通过" ? "内容具备可交付细节" : "内容过短或缺少玩法/任务/资产等可制作细节";

    return `- ${role}: ${status}。${reason}。`;
  });
  const hasAnyRework = auditRows.some((row) => row.includes("返工"));
  const gateStatus = hasAnyRework ? "暂缓交给 engineer，先返工未达标角色" : "全部通过，交给 engineer 进入制作集成";

  const content = [
    "## 主管复审",
    "",
    `任务：${commandText}`,
    "",
    "主管职责升级：不只在开头定规则分任务，还要在员工交付后进行质量审核，检查是否偷懒、是否缺少可制作细节、是否满足协作标准。",
    "",
    "### 审核对象",
    "",
    "- writer：检查是否给出可玩的章节、选择和后果，而不是只写故事背景。",
    "- artist：检查是否给出可生成/可实现的资产清单、UI 约束和视觉规则，而不是只写氛围。",
    "- researcher：检查是否把主题转成机制、数值、状态字段和 playtest 风险，而不是只写分析。",
    "",
    "### 审核结果",
    "",
    ...auditRows,
    "",
    `### Gate 结论：${gateStatus}`,
    "",
    "### 交给 engineer 的制作要求",
    "",
    "- 必须读取 manager 的初始规则和本次 review gate。",
    "- 只能把通过审核的员工产物纳入最终制作清单。",
    "- 最终 output 必须包含可打开预览、manifest、角色结果路径和测试说明。",
    "- 如果后续接入真实 Claude Code，要把未通过审核的角色重新派工，而不是直接让 engineer 粗糙拼接。",
  ].join("\n");

  return {
    content,
    gatePassed: !hasAnyRework,
  };
}

function isDonQuixoteTask(commandText: string): boolean {
  const normalized = commandText.toLowerCase();

  return normalized.includes("堂吉") || normalized.includes("quixote");
}

function isMacbethTask(commandText: string): boolean {
  const normalized = commandText.toLowerCase();

  return normalized.includes("麦克白") || normalized.includes("macbeth");
}

function isBuriedGiantTask(commandText: string): boolean {
  const normalized = commandText.toLowerCase();

  return normalized.includes("被掩埋") || normalized.includes("buried giant") || normalized.includes("ishiguro");
}

function isGreenWaterMonsterTask(commandText: string): boolean {
  const normalized = commandText.toLowerCase();

  return normalized.includes("绿毛水怪") || normalized.includes("王小波") || normalized.includes("galgame");
}

function isDeckTowerTask(commandText: string): boolean {
  const normalized = commandText.toLowerCase();

  return normalized.includes("杀戮尖塔") || normalized.includes("slay") || normalized.includes("爬塔") || normalized.includes("卡牌");
}

function roleProfile(role: string): { name: string; specialty: string; voice: string } {
  switch (role) {
    case "manager":
      return {
        name: "制作人林",
        specialty: "控制范围、里程碑、功能优先级和交付风险",
        voice: "像项目负责人一样直接、可执行、少空话",
      };
    case "writer":
      return {
        name: "叙事设计乔",
        specialty: "主线、角色、主题、任务和章节结构",
        voice: "文学感要服务玩法，每段都能落到任务或选择",
      };
    case "artist":
      return {
        name: "美术指导维加",
        specialty: "视觉识别、UI 母题、场景、角色和动画提示",
        voice: "像给概念美术下 brief，具体到颜色、形状和镜头",
      };
    case "researcher":
      return {
        name: "系统研究员沈",
        specialty: "机制、玩家心理、循环、数值钩子和平衡风险",
        voice: "分析玩法因果，不写泛泛设定",
      };
    case "engineer":
      return {
        name: "玩法工程师任",
        specialty: "MVP 架构、数据结构、实现切片和验收项",
        voice: "每条都要能拆成工程任务",
      };
    default:
      return {
        name: `${role} agent`,
        specialty: "本角色生产任务",
        voice: "简洁中文",
      };
  }
}

function renderDonQuixoteRoleResult(role: string, commandText: string): string {
  switch (role) {
    case "manager":
      return [
        "## Manager Plan",
        "",
        `Task: ${commandText}`,
        "",
        "Producer persona: Producer Lin, responsible for turning a public-domain literary premise into a playable RPG scope.",
        "",
        "Working title: The Knight of Impossible Roads.",
        "",
        "Product promise: a comic-tragic RPG where a self-declared knight reads the ordinary world as epic adventure, and the player decides when illusion protects dignity and when it harms others.",
        "",
        "Target experience:",
        "- 12-15 hour narrative RPG with tactical encounters, travel events, reputation pressure, and companion disagreement.",
        "- Tone alternates between broad comedy, bruised idealism, and quiet social satire.",
        "- The adaptation can use the public-domain premise, but the game should build its own quest structure, NPC arcs, and mechanics.",
        "",
        "Core pillars:",
        "- Delusion as interface: the same object can be shown as mundane reality or chivalric fantasy.",
        "- Honor versus consequence: noble intent can create real damage.",
        "- Companion truth-telling: the squire-like partner grounds the party and challenges dangerous choices.",
        "- Road anthology: each region is a playable novella with recurring systems.",
        "",
        "Scope split:",
        "- Vertical slice: inn hub, windmill field, roadside court, one dream duel, one public consequence scene.",
        "- MVP systems: overworld travel, dialogue choices, fantasy/reality toggle, turn-based combat, reputation ledger, quest journal.",
        "- Defer: mounted traversal physics, full Spain map, romance systems, procedural quests.",
      ].join("\n");
    case "writer":
      return [
        "## Writer Narrative",
        "",
        "Writer persona: Narrative Designer Qiao, focused on playable satire and emotional character arcs.",
        "",
        "Premise:",
        "An aging country gentleman renames himself Sir Alonso of the Impossible Roads after reading too many knightly romances. With a pragmatic neighbor, Sando, he leaves home to restore justice. The world refuses to become a romance, but his belief keeps revealing hidden cruelty that respectable people ignore.",
        "",
        "Main cast:",
        "- Sir Alonso: fragile, brave, absurd, and sometimes dangerous. His class is Errant Knight.",
        "- Sando: farmer, negotiator, cook, and reluctant chronicler. His class is Grounded Squire.",
        "- Alda: a village laborer idealized by Alonso as a distant lady; later she becomes a party adviser who rejects being reduced to a symbol.",
        "- The Barber-Judge: comic antagonist who wants to cure Alonso by staging fake adventures.",
        "- The Mirror Knight: a rival who weaponizes Alonso's fantasies to control him.",
        "",
        "Chapter quests:",
        "1. The Giants of Turning Arms: windmills become giants in Alonso's view. The player can charge, investigate sabotage at the mill, or negotiate with terrified workers.",
        "2. The Castle That Charges Rent: an inn becomes a castle. The quest turns into a dispute about debt, hospitality, and who gets to name reality.",
        "3. The Procession of Enchanters: prisoners, monks, actors, and guards appear as a cursed procession. The player decides whether justice means freeing, judging, or listening.",
        "",
        "Ending branches:",
        "- The Laughing Road: Alonso remains a fool, but villages learn to laugh upward at power instead of downward at weakness.",
        "- The Broken Lance: Alonso accepts reality, loses the fantasy interface, and makes one sober act of repair.",
        "- The New Chivalry: the party rewrites knightly ideals into mutual aid, turning errantry into community defense.",
      ].join("\n");
    case "artist":
      return [
        "## Artist Direction",
        "",
        "Artist persona: Art Director Vega, focused on readable contrast between dust-road realism and painted romance.",
        "",
        "Visual thesis:",
        "Every scene has two art passes: sun-baked rural reality and Alonso's illuminated manuscript fantasy. The game should snap between them with page-turn effects, ink blooms, and trumpet stings.",
        "",
        "Palette:",
        "- Reality: ochre roads, lime-washed walls, faded cloth, hard blue sky, dusty greens.",
        "- Fantasy: gold leaf, lapis, crimson banners, exaggerated shadows, heraldic silhouettes.",
        "- Consequence scenes: desaturated colors, broken props, visible bruises, quiet candlelight.",
        "",
        "Character language:",
        "- Alonso: patched armor, too-thin frame, oversized lance, proud but trembling idle animation.",
        "- Sando: round shapes, practical bags, food props, expressive shoulders.",
        "- Alda: grounded work clothes, strong stance, no saintly glow unless the fantasy overlay is active.",
        "- Mirror Knight: polished armor that reflects the player's current delusion meter.",
        "",
        "UI:",
        "- Reality/Fantasy toggle as a visor icon, not a text button.",
        "- Reputation ledger styled as a travel notebook with stains and marginal jokes.",
        "- Quest map as a stitched road ribbon, with chapter icons for mill, inn, procession, and mirror.",
        "",
        "Animation beats:",
        "- Failed heroic charge should be funny for one second, then show real cost.",
        "- Dialogue portraits subtly shift when fantasy overlay changes NPC identity.",
      ].join("\n");
    case "researcher":
      return [
        "## Researcher Systems",
        "",
        "Researcher persona: Systems Researcher Shen, focused on mechanics that make satire playable.",
        "",
        "Primary mechanic: Chivalric Lens",
        "- The player can view a scene through Reality or Romance.",
        "- Romance reveals courage options, symbolic enemies, and morale buffs.",
        "- Reality reveals practical solutions, social costs, traps, and NPC needs.",
        "- Staying too long in either view creates penalties: Cynicism in Reality, Folly in Romance.",
        "",
        "Combat loop:",
        "- Turn-based party combat with Intent, Guard, Appeal, Improvise, and Charge.",
        "- Enemies often have two identities: Windmill/Giant, Innkeeper/Castellan, Guard/Enchanter.",
        "- Winning by force is possible but often worsens reputation.",
        "- Social victory can end fights by exposing exploitation, apologizing, or staging a better story.",
        "",
        "Exploration loop:",
        "- Travel node -> rumor choice -> lens inspection -> encounter -> consequence ledger.",
        "- Party banter changes based on how often the player indulges Alonso.",
        "- Side quests reward repaired relationships more than loot.",
        "",
        "Progression:",
        "- Alonso gains Virtues: Courage, Mercy, Persistence, Humility.",
        "- Sando gains Practical Arts: Bargain, Cook, Patch, Read the Room.",
        "- Party synergy skills require disagreement first, then reconciliation.",
        "",
        "Balancing target:",
        "- Romance should feel powerful and tempting, not merely wrong.",
        "- Reality should solve problems, but overuse can flatten wonder and lower Alonso's resolve.",
      ].join("\n");
    case "engineer":
      return [
        "## Engineer MVP Build List",
        "",
        "Engineer persona: Gameplay Engineer Ren, focused on shippable implementation slices.",
        "",
        "MVP architecture:",
        "- Data-driven quests in JSON: nodes, lens variants, NPC state, consequence tags.",
        "- Turn-based combat state machine: party, enemies, intents, actions, status effects.",
        "- Chivalric Lens renderer flag: swaps labels, sprites, dialogue lines, and available actions.",
        "- Reputation ledger persisted per settlement.",
        "- Final report exporter for designer-readable quest state.",
        "",
        "First playable slice:",
        "1. One road map with four nodes: Village, Windmill Field, Inn, Procession Road.",
        "2. Two playable characters: Alonso and Sando.",
        "3. Three enemy templates with dual identities.",
        "4. Six actions: Charge, Guard, Appeal, Bargain, Improvise, Retreat.",
        "5. One lens toggle with cooldown and Folly/Cynicism meters.",
        "6. Three quests matching the writer plan.",
        "",
        "Data schema sketch:",
        "- Quest: id, title, nodes, lensText, objectives, consequences.",
        "- Actor: id, displayNameReality, displayNameRomance, stats, actions.",
        "- Encounter: id, actors, winRules, loseRules, socialExitRules.",
        "- LedgerEntry: settlement, tag, severity, text.",
        "",
        "Build checklist:",
        "- Week 1: quest data loader, static UI, lens toggle prototype.",
        "- Week 2: combat state machine and dual-identity enemy display.",
        "- Week 3: dialogue/choice consequences and reputation ledger.",
        "- Week 4: art pass, sound cues, save/load, vertical slice polish.",
      ].join("\n");
    default:
      return `Completed ${role}: ${commandText}`;
  }
}

function renderBuriedGiantInspiredRoleResult(role: string, commandText: string): string {
  switch (role) {
    case "manager":
      return [
        "## 制作人方案",
        "",
        `Task: ${commandText}`,
        "",
        "人设：制作人林，负责把用户给出的文学主题转成安全、原创、可落地的 RPG 项目范围。",
        "",
        "版权边界：这是受《被掩埋的巨人》相关主题启发的原创 RPG，不使用原作角色、原作情节、原作地名、原作独特设定或可识别表达。",
        "",
        "工作标题：雾下余烬。",
        "",
        "产品承诺：一款关于记忆、遗忘、老年伴侣、战后创伤与共同和解的叙事探索 RPG。玩家不是寻找某个原作答案，而是在一个原创山谷里决定真相该如何被重新承担。",
        "",
        "目标体验：",
        "- 8 到 10 小时低战斗密度 RPG，重点是探索、对话、记忆回声、关系选择和结局分支。",
        "- 玩家操作两位年迈旅人和临时同伴，穿过被雾覆盖的山谷，恢复或压下被共同遗忘的历史。",
        "- 游戏必须让“记起来”既有价值也有代价：真相能修复身份，也可能重新点燃仇恨。",
        "",
        "核心支柱：",
        "- 记忆不是收集品，而是社会契约：每次恢复记忆都会改变 NPC、地图和冲突状态。",
        "- 老年主角不是弱化设定，而是节奏、耐力、互相照护和回忆可靠性的玩法来源。",
        "- 战后创伤不能做成单纯怪物图鉴，要体现沉默、责任转移和迟到的悼念。",
        "- 和解不是强制大团圆，结局允许遗忘、审判、哀悼、共同守夜等不同代价。",
        "",
        "MVP 范围：",
        "- 一个村庄 hub、一条雾路、一座废堡、一处河边纪念地和一个终局记忆审判。",
        "- 系统：记忆雾值、伴侣羁绊、证词账本、低频回合战斗、对话后果、结局结算。",
      ].join("\n");
    case "writer":
      return [
        "## 叙事设计",
        "",
        "人设：叙事设计乔，负责把记忆与和解主题改成可玩的任务、角色和选择。",
        "",
        "故事前提：",
        "原创山谷“灰苔谷”被一场多年不散的白雾覆盖。雾会让人忘掉仇恨，也忘掉亲人、承诺和罪责。两位年迈旅人岚和弥，在一次葬礼后发现彼此对同一段往事记忆不一致，于是离开村庄，沿着旧战路寻找被抹去的真相。",
        "",
        "主要角色：",
        "- 岚：退休石匠，职业为守碑者，擅长修复遗迹、辨认旧铭文和承受伤害。",
        "- 弥：草药师，职业为灯草医者，擅长安抚、治疗、识别创伤回声。",
        "- 灰犬少年：失去族谱的年轻向导，代表下一代如何继承未知仇恨。",
        "- 无旗骑士：拒绝说出效忠对象的流亡者，知道战争真相的一角。",
        "- 织悼人：负责把恢复的记忆织进公共悼念仪式，而不是让它们变成复仇名单。",
        "",
        "三章任务：",
        "1. 空桌宴：村庄每年给不存在的人留座。玩家选择调查空座名单，或维持村民靠遗忘获得的平静。",
        "2. 苔下石路：旧路碑被刻意翻面。玩家恢复碑文后，会改变两个村落对边界和责任的认知。",
        "3. 河雾守夜：河边埋着战后交换人质的证据。玩家决定公开证词、交给织悼人，或只让当事家庭知道。",
        "",
        "结局分支：",
        "- 雾中安眠：山谷继续和平，但主角也逐渐失去彼此最珍贵的记忆。",
        "- 诸名归来：真相公开，冲突重燃，但新的责任制度开始建立。",
        "- 共守长夜：只公开足够哀悼的真相，把复仇冲动转化为守夜仪式和共同修复。",
      ].join("\n");
    case "artist":
      return [
        "## 美术指导",
        "",
        "人设：美术指导维加，负责把雾、老年旅程、废墟和悼念仪式做成清晰视觉系统。",
        "",
        "视觉命题：",
        "画面不是史诗战争，而是战后很久的潮湿沉默。雾像布，苔像封条，灯火像人还愿意记住彼此的证据。",
        "",
        "色彩：",
        "- 日常：湿灰、苔绿、旧木褐、羊毛白。",
        "- 记忆回声：低饱和金色、暗红线、冷蓝边缘光。",
        "- 冲突场景：铁锈、泥黑、干草黄，避免艳丽英雄感。",
        "",
        "关键场景：",
        "- 村庄空桌长屋：桌上摆着无人认领的碗。",
        "- 雾路：近景清楚、远景被白雾吞掉，路标经常互相矛盾。",
        "- 废堡：没有王者符号，只剩修补过又被砸碎的墙。",
        "- 河边纪念地：石头半沉水中，名字要通过玩家选择才会浮现。",
        "",
        "UI 母题：",
        "- 记忆雾值用一盏油灯表现，灯芯越短，遗忘越强。",
        "- 证词账本像被水泡过的手抄本，玩家可以把证词标记为公开、保留或悼念。",
        "- 羁绊 UI 是两只旧杯子，裂纹会随争执扩大，也可被修补。",
        "",
        "动画：",
        "- 年迈角色移动要慢但有重量；互相搀扶不是装饰，而是交互提示。",
        "- 记忆恢复时场景不闪白，而是局部物件逐渐显出旧使用痕迹。",
      ].join("\n");
    case "researcher":
      return [
        "## 系统研究",
        "",
        "人设：系统研究员沈，负责把记忆、遗忘、创伤和和解落成可玩机制。",
        "",
        "主机制：雾与证词",
        "- 雾值高：敌意低、冲突少、NPC 安稳，但线索缺失、地图模糊、角色关系变浅。",
        "- 雾值低：真相、隐藏道路和新对话出现，但旧仇、恐惧和报复事件上升。",
        "- 证词不是自动真相，玩家要标记来源、可信度、公开范围和可能伤害。",
        "- 伴侣羁绊会影响回忆可靠性：两位主角可能记得不同版本，需要互相校正。",
        "",
        "探索循环：",
        "- 到达地点 -> 观察遗物 -> 触发记忆回声 -> 询问证人 -> 决定记录方式 -> 地图和 NPC 状态改变。",
        "- 每个地点至少有一个“记住的收益”和一个“记住的代价”。",
        "- 玩家可选择把记忆交给个人、村庄、悼念仪式或暂时封存。",
        "",
        "战斗循环：",
        "- 低频回合战斗，敌人多为恐惧形体、誓言残影、误认对手的人。",
        "- 行动包括守护、呼唤名字、展示证物、撤退、攻击。",
        "- 最优解通常不是杀死敌人，而是让冲突对象被正确辨认。",
        "",
        "成长：",
        "- 岚：守护、修补、铭刻、负重。",
        "- 弥：安抚、治疗、辨香、唤回。",
        "- 队伍轨道：雾值、羁绊、公开真相、复仇风险、共同悼念。",
      ].join("\n");
    case "engineer":
      return [
        "## 玩法工程清单",
        "",
        "人设：玩法工程师任，负责把原创记忆 RPG 拆成可实现的垂直切片。",
        "",
        "MVP 架构：",
        "- Quest 数据：地点、遗物、证词、公开范围、雾值变化、NPC 状态变化。",
        "- MemoryEcho 数据：触发条件、画面覆盖、可选解释、后果标签。",
        "- Dialogue 状态：证词可信度、角色关系、是否公开、是否进入悼念仪式。",
        "- Combat 状态机：低频回合制、恐惧形体、证物行动、非致命解决。",
        "- Output：生成 final-report.md 和 game-preview.html，方便在浏览器查看设计结果。",
        "",
        "第一可玩切片：",
        "1. 村庄 hub：6 个 NPC、空桌宴任务、一次公开/保留证词选择。",
        "2. 雾路：3 个遗物交互、雾值影响道路可见性。",
        "3. 废堡：一次恐惧形体战斗，支持攻击和证物化解两种路线。",
        "4. 河边纪念地：根据证词账本结算三个结局原型。",
        "",
        "数据结构草案：",
        "- Testimony：id、来源、可信度、公开范围、伤害风险、悼念价值。",
        "- MemoryEcho：id、地点、触发物、雾值阈值、回声文本、状态修改。",
        "- BondState：岚/弥分歧点、修复事件、共同记忆等级。",
        "- EndingState：雾值、公开真相、复仇风险、悼念完成度。",
        "",
        "实现清单：",
        "- 第 1 周：地图、证词账本、雾值 UI。",
        "- 第 2 周：记忆回声系统和对话后果。",
        "- 第 3 周：低频战斗和证物化解。",
        "- 第 4 周：game-preview.html、存档、结局结算和演示打磨。",
      ].join("\n");
    default:
      return `Completed ${role}: ${commandText}`;
  }
}

function renderGreenWaterMonsterInspiredRoleResult(role: string, commandText: string): string {
  switch (role) {
    case "manager":
      return [
        "## 制作人方案",
        "",
        `Task: ${commandText}`,
        "",
        "人设：制作人林，负责把用户给出的文学气质转成安全、原创、可落地的 galgame 项目范围。",
        "",
        "版权边界：这是受《绿毛水怪》相关青春、荒诞、通信、异类感与温柔反叛气质启发的原创 galgame，不使用原作角色、原作情节、原作独特表达或可识别桥段。",
        "",
        "工作标题：绿潮来信。",
        "",
        "产品承诺：一款中文青春荒诞 galgame。玩家在海边工业小城收到一封封来自“水怪社”的匿名信，逐渐发现所谓怪物不是敌人，而是青春期无法被正常命名的孤独、欲望、聪明和反抗。",
        "",
        "目标体验：",
        "- 4 到 6 小时视觉小说，包含多女主/多友人路线、短信/书信系统、低强度探索、选择分支和真结局。",
        "- 文风要求：中文输出，机智、克制、反讽，但不模仿任何具体作者句式。",
        "- 游戏主题：青春期异类感、城市边缘、自由想象、亲密关系、成人世界的荒唐规则。",
        "",
        "核心支柱：",
        "- 信件驱动叙事：每封信既是线索，也是角色对现实的改写。",
        "- 怪物不是怪物：水怪传闻会随玩家选择变成玩笑、秘密组织、心理投射或真实奇观。",
        "- Galgame 关系线：不是单纯恋爱选择，而是“是否理解对方的怪异”。",
        "- 结局不灌鸡汤：允许错过、误解、一起逃课、共同创作和各自长大。",
        "",
        "MVP 范围：",
        "- 三个主要角色路线、一个海边地图、一个学校地图、一个废弃泵站地图。",
        "- 系统：信件收件箱、好感/理解度、荒诞值、选择回溯、CG 解锁、结局树。",
      ].join("\n");
    case "writer":
      return [
        "## 叙事设计",
        "",
        "人设：叙事设计乔，负责把青春荒诞气质改成可玩的 galgame 路线和选择。",
        "",
        "故事前提：",
        "1990 年代末的海边工业小城“青盐市”，高中生陈默在旧图书馆的借书卡里发现一封署名“绿潮”的信。信里说：学校排水渠里住着一只绿色水怪，它专门吃掉学生没敢说出口的话。陈默以为这是恶作剧，却很快被卷入一个名为“水怪社”的秘密通信游戏。",
        "",
        "主要角色：",
        "- 陈默：玩家视角主角，擅长写冷笑话，害怕认真表达。",
        "- 林藻：理科尖子，常说自己想变成两栖动物，路线主题是聪明人的孤独。",
        "- 夏汐：广播站成员，收集城市噪音，路线主题是声音、误会和公开告白。",
        "- 许湾：转学生，画怪物漫画，路线主题是被看见与被误读。",
        "- 老谢：图书管理员，知道上一代“水怪社”的失败故事。",
        "",
        "三章结构：",
        "1. 借书卡里的绿信：玩家决定是否回信，开启不同角色的通信频率。",
        "2. 排水渠夜航：三条路线在同一晚分叉，玩家选择跟谁去寻找水怪。",
        "3. 毕业前的涨潮：学校要拆掉旧泵站，玩家决定公开水怪社、保留秘密，或把所有信投进海里。",
        "",
        "结局分支：",
        "- 普通结局：水怪只是传闻，大家毕业后失联，但主角保留写信习惯。",
        "- 角色结局：理解某位角色的怪异，解锁双人 CG 和未来通信。",
        "- 真结局：水怪社不是逃避现实，而是少年们自造语言的方式；众人共同完成最后一本怪物志。",
      ].join("\n");
    case "artist":
      return [
        "## 美术指导",
        "",
        "人设：美术指导维加，负责把海边工业小城、青春荒诞和 galgame UI 做成统一视觉。",
        "",
        "视觉命题：",
        "画面要像潮湿练习本上的涂鸦：现实是旧校服、锈铁、海风和日光灯；幻想是绿色水纹、怪物贴纸和手写信纸边缘长出的鳞片。",
        "",
        "色彩：",
        "- 日常：粉笔白、校服蓝、旧墙灰、午后橙。",
        "- 水怪传闻：荧光绿、海藻绿、深水蓝。",
        "- 亲密场景：低饱和粉、暖黄台灯、雨后玻璃反光。",
        "",
        "关键场景：",
        "- 旧图书馆：借书卡抽屉、风扇、泛黄小说、藏信暗格。",
        "- 学校排水渠：水泥墙、绿苔、手电光、远处海声。",
        "- 广播站：磁带、话筒、窗外操场、被剪断的广播线。",
        "- 废弃泵站：最终章地图，墙上画满历代水怪社涂鸦。",
        "",
        "UI 母题：",
        "- 对话框像半透明信纸，角色名使用手写标签。",
        "- 收件箱是借书卡盒，读过的信会留下水渍。",
        "- 好感不叫好感，叫“理解度”；荒诞值用绿色潮位线表示。",
        "",
        "CG 方向：",
        "- 林藻路线：实验室水槽和窗外暴雨。",
        "- 夏汐路线：广播站夜间独白。",
        "- 许湾路线：废泵站墙绘完成瞬间。",
      ].join("\n");
    case "researcher":
      return [
        "## 系统研究",
        "",
        "人设：系统研究员沈，负责把 galgame 的路线、信件和选择后果设计成清晰系统。",
        "",
        "主机制：信件与理解度",
        "- 玩家每天可选择回一封信、调查一个地点、或写一段不寄出的草稿。",
        "- 理解度不是讨好角色，而是玩家是否读懂对方的表达方式。",
        "- 荒诞值越高，水怪传闻越像真实奇观；荒诞值越低，故事更偏现实青春片。",
        "- 真结局要求三条路线都留下关键理解，而不是把所有角色好感刷满。",
        "",
        "Galgame 循环：",
        "- 白天学校对话 -> 傍晚地图探索 -> 夜间读信/回信 -> 梦境或水怪传闻变化。",
        "- 选择分为三类：认真回答、开玩笑回避、把话写进怪物设定。",
        "- 每类选择会改变角色理解度和城市传闻状态。",
        "",
        "分支规则：",
        "- 林藻路线偏理性和逃离：要求玩家尊重她的冷幽默，而不是逼她变温柔。",
        "- 夏汐路线偏声音和公开：要求玩家选择何时沉默，何时让话被所有人听见。",
        "- 许湾路线偏创作和被看见：要求玩家区分欣赏怪物画和消费她的怪异。",
        "",
        "失败与回收：",
        "- 没有坏结局虐玩家，但会有错过结局、误读结局和过度解释结局。",
        "- 回收系统允许读未寄出的草稿，理解自己当时为什么没说出口。",
      ].join("\n");
    case "engineer":
      return [
        "## 玩法工程清单",
        "",
        "人设：玩法工程师任，负责把中文 galgame 拆成可实现的垂直切片。",
        "",
        "MVP 架构：",
        "- Script 数据：章节、场景、角色、台词、选择、跳转条件。",
        "- Letter 数据：发信人、收到日期、正文、可选回复、理解度变化、荒诞值变化。",
        "- RouteState：三条角色路线的理解度、关键选择、CG 解锁、结局标记。",
        "- MapNode：图书馆、排水渠、广播站、泵站，控制可探索事件。",
        "- Gallery：CG、信件、草稿、怪物志条目。",
        "",
        "第一可玩切片：",
        "1. 标题界面、存读档、文本框、角色立绘切换。",
        "2. 第一章：旧图书馆发现绿信，玩家选择是否回信。",
        "3. 三个地点探索：图书馆、排水渠、广播站。",
        "4. 三个角色各一段关键对话和一封可回复信件。",
        "5. 一个短结局：玩家决定是否加入水怪社。",
        "",
        "数据结构草案：",
        "- Choice：id、文本、条件、效果、下一节点。",
        "- Letter：id、sender、body、replyOptions、routeEffects。",
        "- CharacterState：理解度、误读值、关键 CG、路线锁定状态。",
        "- EndingState：路线、荒诞值、公开秘密、怪物志完成度。",
        "",
        "实现清单：",
        "- 第 1 周：视觉小说播放器、文本脚本解析、基础 UI。",
        "- 第 2 周：信件系统、地图节点、路线状态。",
        "- 第 3 周：三角色 MVP 路线和 CG 占位。",
        "- 第 4 周：game-preview.html、音乐音效、结局树和演示打磨。",
      ].join("\n");
    default:
      return `Completed ${role}: ${commandText}`;
  }
}

function renderDeckTowerRoleResult(role: string, commandText: string): string {
  switch (role) {
    case "manager":
      return [
        "## 制作人方案",
        "",
        `Task: ${commandText}`,
        "",
        "人设：制作人林，负责把“爬塔卡牌 roguelike”做成原创项目范围。",
        "",
        "版权边界：本项目只参考卡牌构筑、路线爬塔、随机事件、遗物协同这类玩法类型，不复制《杀戮尖塔》的名称、角色、卡牌、遗物、敌人、美术、UI 或数值表达。",
        "",
        "工作标题：星炉远征。",
        "",
        "产品承诺：一款原创科幻炼金风爬塔卡牌游戏。玩家驾驶移动星炉穿过破碎轨道，用卡牌驱动引擎、护盾、无人机和炼金反应，在每层路线中选择战斗、事件、商店、维修和精英挑战。",
        "",
        "核心支柱：",
        "- 三职业首发：炉心骑士、星图术士、废料机师。",
        "- 卡组不是技能列表，而是飞船系统：热量、护盾、电荷、无人机、裂变反应互相联动。",
        "- 路线选择强调风险：短路层、陨石雨、黑市港、遗迹信标、精英巡逻。",
        "- 素材全部原创生成：卡面图标、敌人剪影、遗物徽章、地图节点和背景都用项目内生成规则描述。",
        "",
        "MVP 范围：",
        "- 1 个职业、45 张卡、18 个敌人、20 个遗物、12 个事件、3 层地图、1 个最终 Boss。",
      ].join("\n");
    case "writer":
      return [
        "## 叙事设计",
        "",
        "人设：叙事设计乔，负责把爬塔路线包装成有世界观的远征。",
        "",
        "世界观：",
        "旧帝国把恒星碎片封进移动炉心，结果整片轨道带变成漂浮迷宫。玩家所属的星炉远征队要穿过三层废轨，抵达“冷太阳”核心，决定重启星炉、熄灭它，或把它拆成自由城邦的能源。",
        "",
        "三层结构：",
        "1. 锈环外带：教学层，敌人是巡逻艇、寄生矿机和走私哨兵。",
        "2. 静电教区：机制层，敌人会干扰抽牌、锁卡和制造过载。",
        "3. 冷太阳内核：高风险层，事件会改变最终 Boss 形态。",
        "",
        "角色职业：",
        "- 炉心骑士：用热量换爆发，靠护盾防止自燃。",
        "- 星图术士：预知抽牌、折叠回合、改写路线奖励。",
        "- 废料机师：召唤无人机，牺牲零件换临时卡和遗物触发。",
        "",
        "结局：",
        "- 重启星炉：获得秩序，代价是轨道居民重新被统一管制。",
        "- 熄灭冷太阳：结束灾难，世界进入漫长能源寒冬。",
        "- 拆炉分光：最难真结局，把能源分给各城邦，路线要求高声望和低污染。",
      ].join("\n");
    case "artist":
      return [
        "## 美术与素材生成",
        "",
        "人设：美术指导维加，负责原创素材规则，不借用任何既有卡牌游戏视觉。",
        "",
        "整体视觉：科幻炼金、粗颗粒像素叠加手绘金属纹理；主色为炉心橙、深空蓝、氧化铜绿、警报红。",
        "",
        "素材生成规则：",
        "- 卡牌图标：用几何符号组合生成，热量=三角火芯，护盾=六边形壳，电荷=断裂圆环，无人机=小型十字机翼。",
        "- 敌人剪影：每个敌人由“船体形状 + 推进器数量 + 破损部位 + 发光核心”四个参数生成。",
        "- 遗物徽章：圆形底座、金属裂纹、单色发光符号，避免写实器物过多。",
        "- 地图节点：战斗=小爆点，事件=问号星尘，商店=轨道摊位，维修=扳手环，精英=双层警戒框。",
        "",
        "首批素材清单：",
        "- 12 张攻击卡卡面、12 张技能卡卡面、8 张反应卡卡面、5 个 Boss 阶段背景。",
        "- 敌人：锈蚀巡逻艇、裂解修士、空壳矿机、黑市炮台、冷太阳化身。",
      ].join("\n");
    case "researcher":
      return [
        "## 系统研究",
        "",
        "人设：系统研究员沈，负责卡牌、遗物、路线和战斗循环。",
        "",
        "主机制：热量与反应",
        "- 热量是资源也是风险：高热提高伤害，回合结束若过载会烧毁手牌或损血。",
        "- 反应牌需要满足条件，例如“本回合获得 8 点护盾后触发电弧”。",
        "- 遗物不只是数值加成，要改变卡组目标，例如把过载伤害转成护盾。",
        "",
        "战斗循环：",
        "- 抽 5 张牌 -> 分配能量 -> 攻击/防御/反应 -> 敌人意图结算 -> 热量衰减或过载。",
        "- 敌人意图公开，但部分敌人会伪装意图，需要侦测卡揭露。",
        "",
        "路线循环：",
        "- 每层 12 到 15 个节点，玩家选择风险收益。",
        "- 精英给强遗物但提高污染值；污染会改变事件和最终 Boss 技能。",
        "",
        "样例卡：",
        "- 炉刃斩：1 能量，造成 7 伤害；若热量大于 6，追加 4 伤害。",
        "- 冷却阀：1 能量，获得 8 护盾，热量 -3。",
        "- 星图折返：0 能量，查看抽牌堆顶 3 张，选择 1 张置入手牌。",
      ].join("\n");
    case "engineer":
      return [
        "## 玩法工程清单",
        "",
        "人设：玩法工程师任，负责实现切片和可运行预览。",
        "",
        "MVP 架构：",
        "- CardDef：id、名称、类型、费用、标签、效果脚本、生成素材参数。",
        "- RelicDef：id、触发时机、条件、效果、徽章参数。",
        "- EnemyDef：血量、意图表、行动权重、剪影参数。",
        "- MapNode：层数、类型、奖励、风险、连接节点。",
        "- RunState：牌组、弃牌堆、抽牌堆、遗物、金币、污染、路线历史。",
        "",
        "第一可玩切片：",
        "1. 牌组战斗：抽牌、出牌、弃牌、敌人意图、胜负结算。",
        "2. 炉心骑士 15 张卡，6 个敌人，5 个遗物。",
        "3. 单层 10 节点地图，含战斗、事件、商店、精英和 Boss。",
        "4. 生成素材预览：用 CSS/SVG 规则生成卡牌图标、敌人剪影和遗物徽章。",
        "",
        "实现清单：",
        "- 第 1 周：战斗状态机和卡牌效果解释器。",
        "- 第 2 周：地图生成、奖励选择、遗物触发。",
        "- 第 3 周：原创素材生成器和 game-preview.html 演示。",
        "- 第 4 周：平衡、存档、动画和音效占位。",
      ].join("\n");
    default:
      return `Completed ${role}: ${commandText}`;
  }
}

function renderMacbethRoleResult(role: string, commandText: string): string {
  switch (role) {
    case "manager":
      return [
        "## 制作人方案",
        "",
        `Task: ${commandText}`,
        "",
        "人设：制作人林，负责把公版悲剧改造成可落地的 RPG 项目范围。",
        "",
        "工作标题：灰烬王冠（Crown of Cinders）。",
        "",
        "产品承诺：一款关于野心、预言、罪疚和政治崩塌的黑暗战棋 RPG。每一次胜利都会让王国更难被拯救。",
        "",
        "目标体验：",
        "- 10 到 12 小时叙事战棋 RPG，包含宫廷阴谋、战场选择、超自然压力和道德滑坡分支。",
        "- 玩家从受人敬仰的战功英雄开始，逐步选择抵抗、利用或改写预言。",
        "- 可以使用公版原作前提，但系统、支线阵营和互动结局要做成游戏原创表达。",
        "",
        "核心支柱：",
        "- 预言即任务压力：预言不是命令，但 NPC 和派系会把它当成命令来行动。",
        "- 野心经济：权力解锁强力指令，同时提高疑心、敌对联盟和幻觉事件。",
        "- 血债账本：暴力捷径会留下政治和超自然后果。",
        "- 城堡经营：任命廷臣、布置密探、安排巡逻、处理宴会事故和忠诚危机。",
        "",
        "MVP 切片：",
        "- 一个战场教程、一个荒原预言场景、一个城堡 hub、一个宴会危机、一个围城终局。",
        "- 系统：预言卡、罪疚值、忠诚地图、回合战棋、分支对话、结局结算器。",
      ].join("\n");
    case "writer":
      return [
        "## 叙事设计",
        "",
        "人设：叙事设计乔，负责把悲剧结构改成可玩选择和派系压力。",
        "",
        "故事前提：",
        "将军梅尔从战场归来，进入一个分裂的北境王国。三位披灰先知许诺他终将戴上王冠，但他越想保障未来，就越制造毁掉未来的恐惧。他的伴侣莉莎会随玩家选择成为战略家、良知，或共犯。",
        "",
        "主要角色：",
        "- 梅尔：老练统帅，可操作君主，职业为血冠领主。",
        "- 莉莎：政治伴侣，职业为银舌摄政。",
        "- 班里克：忠诚战友，其后代会成为预言目标。",
        "- 凯尔：流亡王子，正在集结外援和本地反对派。",
        "- 灰烬三姊妹：她们不只说谜语，还直接改变机制规则。",
        "",
        "三章任务：",
        "1. 三灰荒原：战胜归来后，选择隐藏、公开或武器化预言。",
        "2. 空椅宴会：幻觉与宫廷猜疑在公开宴会上爆发，玩家必须压住恐慌却不能坐实罪名。",
        "3. 行军之林：森林变成战棋地图，叛军利用伪装、谣言和移动掩体逼近城堡。",
        "",
        "结局分支：",
        "- 铁之冠：梅尔靠恐惧维持权力，王国活下来，但变成牢笼。",
        "- 灰之冠：预言完成，建立在谋杀上的一切被烧尽。",
        "- 拒冠：玩家通过自白、退位，或把终战变成公开审判来打断循环。",
      ].join("\n");
    case "artist":
      return [
        "## 美术指导",
        "",
        "人设：美术指导维加，负责舞台悲剧感、战场泥泞感和超自然侵入感。",
        "",
        "视觉命题：",
        "游戏像一座被湿冷战场吞没的烛光舞台。现实是铁、泥、羊毛和烟；预言是白灰、不可能的月光和红线。",
        "",
        "色彩：",
        "- 战争：黑铁、泥炭褐、雨蓝、火把橙。",
        "- 宫廷：暗金、深绒、血红、骨白。",
        "- 超自然：灰白、病绿、月银、红线色。",
        "",
        "关键场景：",
        "- 被雷雨打穿的荒原，浅水里倒映三轮月亮。",
        "- 城堡 hub：作战室、礼拜堂、宴会厅、城垛和私人寝室。",
        "- 移动森林战场，树枝在雾中变成敌军轮廓。",
        "- 宴会场景里，空椅子的光比活人更强。",
        "",
        "UI 母题：",
        "- 预言卡是被雨水泡烂的羊皮纸。",
        "- 血债账本是王室账簿，墨迹会逐渐变红。",
        "- 罪疚值用角色头像周围忽明忽暗的烛火表现。",
        "",
        "动画：",
        "- 疑心上升时，梅尔待机姿势越来越僵硬。",
        "- 共犯路线加深后，莉莎头像从温和建议转为冷静命令。",
        "- 幻觉先闪现几帧，然后变成可交互威胁。",
      ].join("\n");
    case "researcher":
      return [
        "## 系统研究",
        "",
        "人设：系统研究员沈，负责让悲剧主题变成可读、可平衡的玩法机制。",
        "",
        "主机制：预言压力",
        "- 每条预言是一张卡，包含触发条件、诱惑奖励和公开流言等级。",
        "- 主动推动预言会获得权力，但提高罪疚和疑心。",
        "- 无视预言能保持稳定，但敌对派系会替玩家解释它。",
        "- 打破预言需要付出真相、牺牲或联盟代价。",
        "",
        "战斗循环：",
        "- 格子战棋，包含统帅光环、士气、天气和恐惧状态。",
        "- 梅尔可使用王令强化友军，但消耗忠诚。",
        "- 罪疚会在战斗中召出幻觉敌人；击败它们不一定解决政治问题。",
        "- 非致命胜利能保留合法性，并解锁自白路线。",
        "",
        "宫廷循环：",
        "- 任命议会职位、举办宴会、审问密探、赦免对手、管理流言。",
        "- 每次谋杀都会生成血债账本条目，记录目击者、受益者和闹鬼风险。",
        "- 莉莎的建议会随玩家奖励实用主义、仁慈或保密而变化。",
        "",
        "成长：",
        "- 梅尔路线：统帅、篡位者、忏悔者。",
        "- 莉莎路线：外交家、设计者、破谶者。",
        "- 王国轨道：忠诚、恐惧、饥荒、叛军势头。",
      ].join("\n");
    case "engineer":
      return [
        "## 玩法工程清单",
        "",
        "人设：玩法工程师任，负责把设计拆成可实现的垂直切片。",
        "",
        "MVP 架构：",
        "- 任务数据：预言卡、场景节点、派系反应、结局标记。",
        "- 战棋状态机：格子、单位、先攻、天气、士气、幻觉刷怪。",
        "- 宫廷经营状态：顾问、忠诚值、流言队列、血债账本。",
        "- 存档数据：章节、预言状态、罪疚/疑心、派系忠诚、杀死/放过的角色。",
        "- 最终输出后生成 game-preview.html，并由 Chromium/Chrome 打开。",
        "",
        "第一可玩切片：",
        "1. 战斗教程：梅尔击败叛军并获得第一条预言。",
        "2. 城堡 hub：三个议会决策和一段莉莎私人场景。",
        "3. 宴会危机：对话和战棋混合，加入幻觉压力。",
        "4. 森林行军终局：移动掩体战棋地图和结局结算。",
        "",
        "数据结构草案：",
        "- ProphecyCard：id、文本、触发条件、推动奖励、抵抗代价、流言影响。",
        "- Unit：id、职业、属性、士气、忠诚、状态、技能。",
        "- CourtEvent：id、出席者、选项、派系影响、血债账本条目。",
        "- EndingState：王冠状态、罪疚等级、叛乱等级、自白标记。",
        "",
        "实现清单：",
        "- 第 1 周：数据加载器、场景渲染器、预言卡 UI。",
        "- 第 2 周：格子战棋原型和士气/恐惧效果。",
        "- 第 3 周：宫廷循环、血债账本、幻觉事件。",
        "- 第 4 周：Chromium 游戏预览、存读档、垂直切片打磨。",
      ].join("\n");
    default:
      return `Completed ${role}: ${commandText}`;
  }
}
