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
    const renderingRules = createAssetRenderingRules(item);
    const asset = await generateQwenImageAsset({
      label: item.label,
      prompt: [
        "你是游戏 artist 的生图工具。根据主管要求和 artist 视觉稿生成可直接用于游戏的图片资产。",
        "通用规则：原创、可商用风格、不要真实公众人物肖像、不要受版权保护角色、不要复刻现有作品画面、不要文字密集。",
        `资产用途：${item.purpose}`,
        "资产渲染规则：",
        ...renderingRules.map((rule) => `- ${rule}`),
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
      "如果资产是角色、敌人、伙伴、单位、头像、立绘、sprite、道具或可拖拽对象，必须在 purpose 和 prompt 中写明：透明背景 PNG、无场景背景、抠图/立绘、主体完整、边缘干净、适合叠加到 HTML UI。",
      "如果资产是背景、标题主视觉、地图或场景，必须写明横向 16:9 或宽屏构图、留出 UI 安全区；不要把所有图片都规划成正方形。",
      "如果资产是流程图、徽章、卡牌、按钮或 UI 图示，必须写明适合其用途的长宽比例，例如横向流程图、竖向卡牌、细长徽章。",
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
    return normalizePlan(JSON.parse(extractJson(raw.content)) as ArtistImagePlan, request);
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
        prompt: `${brief}\n生成标题页主视觉，横向 16:9 宽屏构图，明确主体与环境，留出 UI 安全区，不要正方形海报构图。`,
      },
      {
        label: "artist-main-character",
        purpose: "主要角色立绘或核心单位，透明背景 PNG 抠图",
        prompt: `${brief}\n生成主要角色/核心单位立绘，透明背景 PNG，无场景背景，主体完整，边缘干净，适合叠加到游戏 UI 或 Canvas 中。构图优先竖向全身或半身，不要正方形头像裁切。`,
      },
      {
        label: "artist-secondary-subject",
        purpose: "关键对手、伙伴、道具或幻想元素，透明背景 PNG 抠图",
        prompt: `${brief}\n生成关键视觉元素图，透明背景 PNG，无场景背景，主体完整，边缘干净，能被玩家一眼识别其玩法/剧情用途。角色/单位用竖向立绘，道具用紧凑物件扣图，不要正方形背景图。`,
      },
      {
        label: "artist-background",
        purpose: "主要场景背景",
        prompt: `${brief}\n生成主要场景背景图，横向 16:9 宽屏构图，适合浏览器游戏画布或对话界面，留出 UI 安全区，不要正方形。`,
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

export function createAssetRenderingRules(asset: { label: string; purpose: string; prompt: string }): string[] {
  const text = `${asset.label} ${asset.purpose} ${asset.prompt}`;

  if (isCutoutAsset(text)) {
    return [
      "这是角色/单位/头像/道具类可叠加资产，必须生成透明背景 PNG 扣图。",
      "不要画场景背景、地面、天空、室内、边框、海报背景或纯色底；背景必须透明。",
      "主体完整，边缘干净，适合放进 HTML/CSS/Canvas 叠加层。",
      "角色或单位优先竖向全身/半身立绘，避免正方形头像裁切。",
    ];
  }

  if (isBackgroundAsset(text)) {
    return [
      "这是场景/标题/地图背景类资产，使用横向 16:9 或宽屏构图。",
      "留出 UI 安全区，中心主体不要挡住标题、按钮、状态栏和对话框。",
      "不要做正方形社交媒体海报；画面应该适合浏览器横屏页面。",
    ];
  }

  if (isUiAsset(text)) {
    return [
      "这是 UI/流程/徽章/卡牌类资产，按用途选择比例，不要默认正方形。",
      "流程图和架构图优先横向，卡牌优先竖向，徽章和按钮优先细长横向。",
      "如果需要放在界面上叠加，保持边缘清楚、背景简洁或透明。",
    ];
  }

  return [
    "按资产用途选择合适长宽比例，不要默认正方形。",
    "如果主体需要叠加到界面上，优先透明背景 PNG；如果是环境图，优先横向宽屏构图。",
  ];
}

function isCutoutAsset(text: string): boolean {
  return /角色|人物|主角|敌人|伙伴|单位|头像|立绘|sprite|character|hero|enemy|portrait|avatar|unit|npc|道具|物品|item|prop/i.test(text);
}

function isBackgroundAsset(text: string): boolean {
  return /背景|场景|地图|标题页|首屏|主视觉|环境|background|scene|map|title|key-art|cover/i.test(text);
}

function isUiAsset(text: string): boolean {
  return /UI|界面|流程|架构|徽章|按钮|卡牌|图标|diagram|flow|badge|button|card|icon|panel/i.test(text);
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
