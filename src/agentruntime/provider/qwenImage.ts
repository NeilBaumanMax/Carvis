import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface QwenImageAsset {
  label: string;
  path: string;
  url: string;
}

export interface QwenImageOptions {
  env?: NodeJS.ProcessEnv;
  prompt: string;
  label: string;
  outputDir?: string;
  timeoutMs?: number;
  onRetry?: (event: QwenImageRetryEvent) => void;
}

export interface QwenImageRetryEvent {
  attempt: number;
  nextAttempt: number;
  delayMs: number;
  error: string;
  state: "start" | "end";
}

export async function generateQwenImageAsset(options: QwenImageOptions): Promise<QwenImageAsset> {
  const env = options.env ?? process.env;
  const maxAttempts = readPositiveInteger(env.CARVIS_QWEN_IMAGE_MAX_ATTEMPTS, 3);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await generateQwenImageAssetOnce(options);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableImageError(error)) {
        break;
      }

      const delayMs = readImageRetryDelayMs(env, attempt);
      const retryEvent = {
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      };
      options.onRetry?.({
        ...retryEvent,
        state: "start",
      });
      await sleep(delayMs);
      options.onRetry?.({
        ...retryEvent,
        state: "end",
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function generateQwenImageAssetOnce(options: QwenImageOptions): Promise<QwenImageAsset> {
  const env = options.env ?? process.env;
  const apiKey = env.DASHSCOPE_API_KEY ?? env.QWEN_API_KEY ?? env.QWEN_OPENAI_API_KEY;
  const generationUrl =
    env.QWEN_IMAGE_GENERATION_URL ??
    `${normalizeBaseUrl(
      env.QWEN_DASHSCOPE_BASE_URL ??
        env.QWEN_IMAGE_BASE_URL ??
        deriveDashScopeBaseUrl(env.QWEN_OPENAI_BASE_URL) ??
        "https://dashscope.aliyuncs.com/api/v1",
    )}/services/aigc/multimodal-generation/generation`;
  const model = env.QWEN_IMAGE_MODEL ?? "qwen-image-2.0-pro";
  const outputDir = options.outputDir ?? "output/assets";

  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("Qwen image API key is required in DASHSCOPE_API_KEY, QWEN_API_KEY, or QWEN_OPENAI_API_KEY");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs ?? Number(env.CARVIS_QWEN_IMAGE_TIMEOUT_MS ?? 180_000));

  try {
    const response = await fetch(generationUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "user",
              content: [
                {
                  text: options.prompt,
                },
              ],
            },
          ],
        },
        parameters: {
          n: readPositiveInteger(env.QWEN_IMAGE_N, 1),
          size: env.QWEN_IMAGE_SIZE ?? "1024*1024",
          prompt_extend: env.QWEN_IMAGE_PROMPT_EXTEND !== "false",
          watermark: env.QWEN_IMAGE_WATERMARK === "true",
          negative_prompt:
            env.QWEN_IMAGE_NEGATIVE_PROMPT ??
            "低清晰度，低画质，错字，文字扭曲，水印，畸形，构图混乱，多余文字",
        },
      }),
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Qwen image request failed status=${response.status} body=${text.slice(0, 800)}`);
    }

    const imageUrl = extractImageUrl(text);
    const imageResponse = await fetch(imageUrl, {
      signal: controller.signal,
    });

    if (!imageResponse.ok) {
      throw new Error(`Qwen image download failed status=${imageResponse.status}`);
    }

    await mkdir(outputDir, { recursive: true });
    const path = join(outputDir, `${safeFilename(options.label)}.png`);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    await writeFile(path, buffer);

    return {
      label: options.label,
      path,
      url: imageUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryableImageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return /status=429|Throttling|rate limit|timeout|ECONNRESET|ETIMEDOUT/i.test(message);
}

function readImageRetryDelayMs(env: NodeJS.ProcessEnv, attempt: number): number {
  const base = readPositiveInteger(env.CARVIS_QWEN_IMAGE_RETRY_DELAY_MS, 12_000);

  return base * attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractImageUrl(responseText: string): string {
  const data = JSON.parse(responseText) as {
    output?: {
      choices?: Array<{
        message?: {
          content?: Array<{
            image?: string;
            image_url?: string;
          }>;
        };
      }>;
    };
  };
  const contents = data.output?.choices?.flatMap((choice) => choice.message?.content ?? []) ?? [];
  const imageUrl = contents.map((item) => item.image ?? item.image_url).find((value) => value !== undefined);

  if (imageUrl === undefined || imageUrl.length === 0) {
    throw new Error(`Qwen image response did not contain an image URL: ${responseText.slice(0, 800)}`);
  }

  return imageUrl;
}

function deriveDashScopeBaseUrl(openAiBaseUrl: string | undefined): string | undefined {
  if (openAiBaseUrl === undefined || openAiBaseUrl.length === 0) {
    return undefined;
  }

  return normalizeBaseUrl(openAiBaseUrl).replace(/\/compatible-mode\/v1$/, "/api/v1");
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function safeFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
