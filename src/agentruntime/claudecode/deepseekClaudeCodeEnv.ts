export interface DeepSeekClaudeCodeEnv {
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_AUTH_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
  CLAUDE_CODE_SUBAGENT_MODEL: string;
  CLAUDE_CODE_EFFORT_LEVEL: string;
}

export function createDeepSeekClaudeCodeEnv(
  env: NodeJS.ProcessEnv,
): DeepSeekClaudeCodeEnv {
  const authToken = env.ANTHROPIC_AUTH_TOKEN ?? env.DEEPSEEK_API_KEY;
  const apiKey = env.ANTHROPIC_API_KEY ?? authToken;

  return {
    ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL ?? "https://api.deepseek.com/anthropic",
    ANTHROPIC_AUTH_TOKEN: authToken,
    ANTHROPIC_API_KEY: apiKey,
    ANTHROPIC_MODEL: env.ANTHROPIC_MODEL ?? "deepseek-v4-pro[1m]",
    ANTHROPIC_DEFAULT_OPUS_MODEL:
      env.ANTHROPIC_DEFAULT_OPUS_MODEL ?? "deepseek-v4-pro[1m]",
    ANTHROPIC_DEFAULT_SONNET_MODEL:
      env.ANTHROPIC_DEFAULT_SONNET_MODEL ?? "deepseek-v4-pro[1m]",
    ANTHROPIC_DEFAULT_HAIKU_MODEL:
      env.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? "deepseek-v4-flash",
    CLAUDE_CODE_SUBAGENT_MODEL:
      env.CLAUDE_CODE_SUBAGENT_MODEL ?? "deepseek-v4-flash",
    CLAUDE_CODE_EFFORT_LEVEL: env.CLAUDE_CODE_EFFORT_LEVEL ?? "max",
  };
}

export function mergeClaudeCodeEnv(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  return {
    ...env,
    PATH: withNixSystemPath(env.PATH),
    ...createDeepSeekClaudeCodeEnv(env),
  };
}

export function hasDeepSeekClaudeCodeToken(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.ANTHROPIC_AUTH_TOKEN ?? env.DEEPSEEK_API_KEY);
}

function withNixSystemPath(path: string | undefined): string {
  const entries = [
    ...(path ?? "").split(":").filter((entry) => entry.length > 0),
    "/run/current-system/sw/bin",
    "/run/wrappers/bin",
  ];

  return [...new Set(entries)].join(":");
}
