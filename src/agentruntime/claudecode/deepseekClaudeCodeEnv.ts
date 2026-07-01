export interface DeepSeekClaudeCodeEnv {
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_AUTH_TOKEN?: string;
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
  return {
    ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL ?? "https://api.deepseek.com/anthropic",
    ANTHROPIC_AUTH_TOKEN: env.ANTHROPIC_AUTH_TOKEN,
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
    ...createDeepSeekClaudeCodeEnv(env),
  };
}
