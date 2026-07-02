import type { AgentRole } from "../../shared/types/agent.js";
import { generateQwenImageAsset, type QwenImageAsset } from "../provider/qwenImage.js";
import { runQwenOpenAiText } from "../provider/qwenOpenAi.js";

export interface ArtistImageMcpRequest {
  role: AgentRole;
  commandText: string;
  artistOutput: string;
  outputRootPath?: string;
  onProgress?: (message: string) => void;
}

export interface ArtistImageMcpResult {
  assets: QwenImageAsset[];
  plan: ArtistImagePlan;
  review: string;
}

interface ArtistImagePlan {
  styleRules: string[];
  assets: Array<{
    label: string;
    purpose: string;
    prompt: string;
  }>;
  reviewChecklist: string[];
}

export async function callArtistImageMcp(request: ArtistImageMcpRequest): Promise<ArtistImageMcpResult> {
  if (request.role !== "artist") {
    throw new Error(`artist-image-mcp is restricted to artist role, got ${request.role}`);
  }

  if (process.env.CARVIS_ARTIST_IMAGE_MCP === "0") {
    return {
      assets: [],
      plan: createFallbackPlan(request),
      review: "artist-image-mcp disabled by CARVIS_ARTIST_IMAGE_MCP=0",
    };
  }

  request.onProgress?.("artist-image-mcp: planning image assets");
  const plan = await createArtistImagePlan(request);
  request.onProgress?.(`artist-image-mcp: planned ${plan.assets.length} image assets`);
  const concurrency = readPositiveInteger(process.env.CARVIS_ARTIST_IMAGE_CONCURRENCY, 2);
  const assets = await mapWithConcurrency(plan.assets, concurrency, async (item, index) => {
    request.onProgress?.(`artist-image-mcp: generating ${index + 1}/${plan.assets.length} ${item.label}`);
    const asset = await generateQwenImageAsset({
      label: item.label,
      prompt: [
        "你是游戏 artist 的生图工具。根据主管要求和 artist 视觉稿生成可直接用于游戏的图片资产。",
        "通用规则：原创、可商用风格、不要真实公众人物肖像、不要受版权保护角色、不要复刻现有作品画面、不要文字密集。",
        `资产用途：${item.purpose}`,
        "统一风格规则：",
        ...plan.styleRules.map((rule) => `- ${rule}`),
        "具体生图提示词：",
        item.prompt,
      ].join("\n"),
      outputDir: request.outputRootPath === undefined ? "output/assets" : `${request.outputRootPath}/assets`,
    });
    request.onProgress?.(`artist-image-mcp: generated ${index + 1}/${plan.assets.length} ${asset.path}`);
    return asset;
  });

  return {
    assets,
    plan,
    review: reviewGeneratedAssets(plan, assets),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index] as T, index);
      }
    }),
  );

  return results;
}

export function renderArtistImageMcpAssets(result: ArtistImageMcpResult): string {
  if (result.assets.length === 0) {
    return "";
  }

  return [
    "",
    "## ARTIST_IMAGE_MCP_PLAN",
    "",
    "### Style Rules",
    ...result.plan.styleRules.map((rule) => `- ${rule}`),
    "",
    "### Planned Assets",
    ...result.plan.assets.map((asset) => `- ${asset.label}: ${asset.purpose}`),
    "",
    "## GENERATED_IMAGE_ASSETS",
    "",
    ...result.assets.map((asset) => `- ${asset.label}: ${asset.path}`),
    "",
    "## ARTIST_IMAGE_MCP_SELF_REVIEW",
    "",
    result.review,
    "",
    "这些图片由 artist-image-mcp 生成。Engineer 必须在最终 HTML 中使用这些本地图片资产；从 output/game-preview.html 引用时使用相对路径 assets/文件名。",
  ].join("\n");
}

async function createArtistImagePlan(request: ArtistImageMcpRequest): Promise<ArtistImagePlan> {
  const raw = await runQwenOpenAiText({
    model: process.env.QWEN_OPENAI_MODEL ?? process.env.QWEN_MODEL ?? process.env.QWEN_OMNI_MODEL,
    systemPrompt: [
      "你是游戏项目的 artist。你的任务不是写剧情，而是根据主管要求和自己的视觉稿规划真实生图资产。",
      "请只输出 JSON，不要 markdown。",
      "JSON schema: {\"styleRules\":[string],\"assets\":[{\"label\":string,\"purpose\":string,\"prompt\":string}],\"reviewChecklist\":[string]}",
      "assets 数量由你根据项目需要决定，但通常 3-6 张；如果主管明确要求数量，遵守主管要求。",
      "label 只能用英文小写、数字和短横线，必须以 artist- 开头。",
      "prompt 要能直接交给图像生成模型，描述画面、构图、主体、风格、用途和约束。",
    ].join("\n"),
    userPrompt: [
      "## 用户/主管任务",
      request.commandText,
      "",
      "## Artist 已写视觉稿",
      request.artistOutput.slice(0, 4_000),
      "",
      "请以 artist 视角决定需要生产哪些图片资产，并输出 JSON。",
    ].join("\n"),
    timeoutMs: 120_000,
  });

  try {
    return normalizePlan(JSON.parse(extractJson(raw)) as ArtistImagePlan, request);
  } catch {
    return createFallbackPlan(request);
  }
}

function normalizePlan(plan: ArtistImagePlan, request: ArtistImageMcpRequest): ArtistImagePlan {
  const fallback = createFallbackPlan(request);
  const styleRules = Array.isArray(plan.styleRules) && plan.styleRules.length > 0 ? plan.styleRules : fallback.styleRules;
  const reviewChecklist =
    Array.isArray(plan.reviewChecklist) && plan.reviewChecklist.length > 0 ? plan.reviewChecklist : fallback.reviewChecklist;
  const requestedMinimum = readMinimumAssetCount(request.commandText);
  const assets = Array.isArray(plan.assets) ? plan.assets.filter(isUsablePlannedAsset) : [];
  const normalizedAssets = [...assets];

  for (const fallbackAsset of fallback.assets) {
    if (normalizedAssets.length >= requestedMinimum) {
      break;
    }

    normalizedAssets.push(fallbackAsset);
  }

  return {
    styleRules,
    assets: normalizedAssets.slice(0, 6).map((asset, index) => ({
      label: safeLabel(asset.label, index),
      purpose: asset.purpose,
      prompt: asset.prompt,
    })),
    reviewChecklist,
  };
}

function createFallbackPlan(request: ArtistImageMcpRequest): ArtistImagePlan {
  const brief = request.artistOutput.slice(0, 1_200);

  return {
    styleRules: ["统一色彩、构图和 UI 安全区", "图片必须服务玩法界面，不只做概念海报", "原创角色和场景，不复刻已有作品"],
    assets: [
      {
        label: "artist-key-art",
        purpose: "标题页/首屏主视觉",
        prompt: `${brief}\n生成标题页主视觉，横向构图，明确主体与环境，留出 UI 安全区。`,
      },
      {
        label: "artist-main-character",
        purpose: "主要角色立绘或核心单位",
        prompt: `${brief}\n生成主要角色/核心单位图，适合放在游戏 UI 内，背景干净。`,
      },
      {
        label: "artist-secondary-subject",
        purpose: "关键对手、伙伴、道具或幻想元素",
        prompt: `${brief}\n生成关键视觉元素图，能被玩家一眼识别其玩法/剧情用途。`,
      },
      {
        label: "artist-background",
        purpose: "主要场景背景",
        prompt: `${brief}\n生成主要场景背景图，适合浏览器游戏画布或对话界面。`,
      },
    ].slice(0, Math.max(3, readMinimumAssetCount(request.commandText))),
    reviewChecklist: ["数量满足主管要求", "每张图都有明确用途", "风格统一", "可被 engineer 引入 HTML"],
  };
}

function reviewGeneratedAssets(plan: ArtistImagePlan, assets: QwenImageAsset[]): string {
  const rows = [
    `生成数量：${assets.length}/${plan.assets.length}`,
    ...plan.reviewChecklist.map((item) => `- ${item}: ${assets.length >= Math.min(plan.assets.length, 1) ? "通过" : "未通过"}`),
    ...assets.map((asset) => `- ${asset.label}: ${asset.path}`),
  ];

  return rows.join("\n");
}

function readMinimumAssetCount(commandText: string): number {
  const match = /至少\s*(\d+)\s*张/.exec(commandText) ?? /(\d+)\s*张/.exec(commandText);

  if (match?.[1] !== undefined) {
    return Math.max(1, Math.min(6, Number.parseInt(match[1], 10)));
  }

  return 3;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isUsablePlannedAsset(asset: ArtistImagePlan["assets"][number]): boolean {
  return (
    typeof asset?.label === "string" &&
    typeof asset.purpose === "string" &&
    typeof asset.prompt === "string" &&
    asset.label.length > 0 &&
    asset.purpose.length > 0 &&
    asset.prompt.length > 0
  );
}

function safeLabel(label: string, index: number): string {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.startsWith("artist-") ? normalized : `artist-${normalized || `asset-${index + 1}`}`;
}

function extractJson(value: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(value);

  if (fenced?.[1] !== undefined) {
    return fenced[1];
  }

  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  return start >= 0 && end > start ? value.slice(start, end + 1) : value;
}
