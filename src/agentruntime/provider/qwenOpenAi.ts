import { readFileSync } from "node:fs";

export interface QwenTextOptions {
  env?: NodeJS.ProcessEnv;
  model?: string;
  enableSearch?: boolean;
  forceSearch?: boolean;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}

export interface ProviderUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_prompt_tokens?: number;
  estimated_completion_tokens?: number;
  estimated_total_tokens?: number;
  prompt_chars: number;
  completion_chars: number;
  total_chars: number;
  source: "provider" | "estimated";
}

export interface QwenTextResult {
  content: string;
  usage: ProviderUsage;
}

export async function runQwenOpenAiText(options: QwenTextOptions): Promise<QwenTextResult> {
  const env = loadQwenEnvironment(options.env ?? process.env);
  const apiKey = env.DASHSCOPE_API_KEY ?? env.QWEN_API_KEY ?? env.QWEN_OPENAI_API_KEY;
  const baseUrl = normalizeBaseUrl(env.QWEN_OPENAI_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1");
  const model = options.model ?? env.QWEN_OMNI_MODEL ?? env.QWEN_OPENAI_MODEL ?? env.QWEN_MODEL ?? "qwen3.5-omni-plus";
  const enableSearch = options.enableSearch ?? env.CARVIS_QWEN_ENABLE_SEARCH === "1";

  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("Qwen API key is required in DASHSCOPE_API_KEY, QWEN_API_KEY, or QWEN_OPENAI_API_KEY");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs ?? Number(env.CARVIS_QWEN_TIMEOUT_MS ?? 180_000));

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
        modalities: ["text"],
        stream: true,
        stream_options: {
          include_usage: true,
        },
        ...(enableSearch
          ? {
              enable_search: true,
              search_options: {
                forced_search: options.forceSearch ?? env.CARVIS_QWEN_FORCE_SEARCH !== "0",
                enable_source: true,
              },
            }
          : {}),
        temperature: Number(env.CARVIS_QWEN_TEMPERATURE ?? 0.35),
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Qwen request failed status=${response.status} body=${text.slice(0, 800)}`);
    }

    const result = parseQwenResponseContent(text);
    const content = result?.content;

    if (content === undefined || content.trim().length === 0) {
      throw new Error(`Qwen response did not contain message content: ${text.slice(0, 800)}`);
    }

    const trimmed = content.trim();
    return {
      content: trimmed,
      usage: createProviderUsage(options.systemPrompt, options.userPrompt, trimmed, result?.usage),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function loadQwenEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const fileEnv = readQwenEnvFile();

  return {
    ...fileEnv,
    ...env,
  };
}

function readQwenEnvFile(): Record<string, string> {
  try {
    return parseEnvFile(readFileSync(".env.qwen-omni", "utf8"));
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

function parseQwenResponseContent(text: string): { content: string; usage?: OpenAiUsage } | undefined {
  if (text.trimStart().startsWith("data:")) {
    return parseQwenStreamContent(text);
  }

  const data = JSON.parse(text) as {
    usage?: OpenAiUsage;
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  const content = data.choices?.[0]?.message?.content;

  return content === undefined ? undefined : { content, usage: data.usage };
}

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

function parseQwenStreamContent(text: string): { content: string; usage?: OpenAiUsage } | undefined {
  let content = "";
  let usage: OpenAiUsage | undefined;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("data:")) {
      continue;
    }

    const payload = trimmed.slice("data:".length).trim();

    if (payload.length === 0 || payload === "[DONE]") {
      continue;
    }

    const data = JSON.parse(payload) as {
      usage?: OpenAiUsage;
      choices?: Array<{
        delta?: {
          content?: string;
        };
        message?: {
          content?: string;
        };
      }>;
    };

    if (data.usage !== undefined) {
      usage = data.usage;
    }
    content += data.choices?.[0]?.delta?.content ?? data.choices?.[0]?.message?.content ?? "";
  }

  return content.length === 0 ? undefined : { content, usage };
}

export function createProviderUsage(
  systemPrompt: string,
  userPrompt: string,
  completion: string,
  providerUsage?: OpenAiUsage,
): ProviderUsage {
  const promptChars = systemPrompt.length + userPrompt.length;
  const completionChars = completion.length;
  const estimatedPromptTokens = estimateTokens(promptChars);
  const estimatedCompletionTokens = estimateTokens(completionChars);

  if (providerUsage?.total_tokens !== undefined) {
    return {
      prompt_tokens: providerUsage.prompt_tokens,
      completion_tokens: providerUsage.completion_tokens,
      total_tokens: providerUsage.total_tokens,
      estimated_prompt_tokens: estimatedPromptTokens,
      estimated_completion_tokens: estimatedCompletionTokens,
      estimated_total_tokens: estimatedPromptTokens + estimatedCompletionTokens,
      prompt_chars: promptChars,
      completion_chars: completionChars,
      total_chars: promptChars + completionChars,
      source: "provider",
    };
  }

  return {
    estimated_prompt_tokens: estimatedPromptTokens,
    estimated_completion_tokens: estimatedCompletionTokens,
    estimated_total_tokens: estimatedPromptTokens + estimatedCompletionTokens,
    prompt_chars: promptChars,
    completion_chars: completionChars,
    total_chars: promptChars + completionChars,
    source: "estimated",
  };
}

function estimateTokens(chars: number): number {
  return Math.max(1, Math.ceil(chars / 4));
}
