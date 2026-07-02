export interface QwenTextOptions {
  env?: NodeJS.ProcessEnv;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}

export async function runQwenOpenAiText(options: QwenTextOptions): Promise<string> {
  const env = options.env ?? process.env;
  const apiKey = env.DASHSCOPE_API_KEY ?? env.QWEN_API_KEY;
  const baseUrl = normalizeBaseUrl(env.QWEN_OPENAI_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1");
  const model = options.model ?? env.QWEN_OMNI_MODEL ?? "qwen3.5-omni-plus";

  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("Qwen API key is required in DASHSCOPE_API_KEY or QWEN_API_KEY");
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
        temperature: Number(env.CARVIS_QWEN_TEMPERATURE ?? 0.35),
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Qwen request failed status=${response.status} body=${text.slice(0, 800)}`);
    }

    const data = JSON.parse(text) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const content = data.choices?.[0]?.message?.content;

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
