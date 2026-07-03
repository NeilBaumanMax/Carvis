import { readFileSync } from "node:fs";

import { createProviderUsage, type ProviderUsage } from "./qwenOpenAi.js";

export interface DeepSeekTextOptions {
  env?: NodeJS.ProcessEnv;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}

export interface DeepSeekTextResult {
  content: string;
  usage: ProviderUsage;
}

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export async function runDeepSeekOpenAiText(options: DeepSeekTextOptions): Promise<DeepSeekTextResult> {
  const env = loadDeepSeekEnvironment(options.env ?? process.env);
  const apiKey = env.DEEPSEEK_API_KEY ?? env.CARVIS_DEEPSEEK_API_KEY;
  const baseUrl = normalizeBaseUrl(env.DEEPSEEK_OPENAI_BASE_URL ?? env.CARVIS_DEEPSEEK_OPENAI_BASE_URL ?? "https://api.deepseek.com");
  const model = options.model ?? env.DEEPSEEK_MODEL ?? env.CARVIS_DEEPSEEK_RESEARCHER_MODEL ?? "deepseek-chat";

  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("DeepSeek API key is required in DEEPSEEK_API_KEY or CARVIS_DEEPSEEK_API_KEY");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs ?? Number(env.CARVIS_DEEPSEEK_API_TIMEOUT_MS ?? 180_000));

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: options.systemPrompt,
          },
          {
            role: "user",
            content: options.userPrompt,
          },
        ],
        stream: false,
        temperature: Number(env.CARVIS_DEEPSEEK_RESEARCHER_TEMPERATURE ?? 0.2),
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`DeepSeek request failed status=${response.status} body=${text.slice(0, 800)}`);
    }

    const data = JSON.parse(text) as {
      usage?: OpenAiUsage;
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();

    if (content === undefined || content.length === 0) {
      throw new Error(`DeepSeek response did not contain message content: ${text.slice(0, 800)}`);
    }

    return {
      content,
      usage: createProviderUsage(options.systemPrompt, options.userPrompt, content, data.usage),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function loadDeepSeekEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const fileEnv = readDeepSeekEnvFile();

  return {
    ...fileEnv,
    ...env,
  };
}

function readDeepSeekEnvFile(): Record<string, string> {
  try {
    return parseEnvFile(readFileSync(".env.deepseek", "utf8"));
  } catch {
    return {};
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    result[key] = value;
  }

  return result;
}
