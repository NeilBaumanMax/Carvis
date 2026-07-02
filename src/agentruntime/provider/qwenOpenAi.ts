import { readFileSync } from "node:fs";

export interface QwenTextOptions {
  env?: NodeJS.ProcessEnv;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}

export async function runQwenOpenAiText(options: QwenTextOptions): Promise<string> {
  const env = loadQwenEnvironment(options.env ?? process.env);
  const apiKey = env.DASHSCOPE_API_KEY ?? env.QWEN_API_KEY ?? env.QWEN_OPENAI_API_KEY;
  const baseUrl = normalizeBaseUrl(env.QWEN_OPENAI_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1");
  const model = options.model ?? env.QWEN_OMNI_MODEL ?? env.QWEN_OPENAI_MODEL ?? env.QWEN_MODEL ?? "qwen3.5-omni-plus";

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
        temperature: Number(env.CARVIS_QWEN_TEMPERATURE ?? 0.35),
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Qwen request failed status=${response.status} body=${text.slice(0, 800)}`);
    }

    const content = parseQwenResponseContent(text);

    if (content === undefined || content.trim().length === 0) {
      throw new Error(`Qwen response did not contain message content: ${text.slice(0, 800)}`);
    }

    return content.trim();
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

function parseQwenResponseContent(text: string): string | undefined {
  if (text.trimStart().startsWith("data:")) {
    return parseQwenStreamContent(text);
  }

  const data = JSON.parse(text) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return data.choices?.[0]?.message?.content;
}

function parseQwenStreamContent(text: string): string | undefined {
  let content = "";

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
      choices?: Array<{
        delta?: {
          content?: string;
        };
        message?: {
          content?: string;
        };
      }>;
    };

    content += data.choices?.[0]?.delta?.content ?? data.choices?.[0]?.message?.content ?? "";
  }

  return content.length === 0 ? undefined : content;
}
