import { createDeepSeekClaudeCodeEnv } from "./agentruntime/claudecode/deepseekClaudeCodeEnv.js";

export async function bootstrapCarvis(): Promise<void> {
  const claudeCodeEnv = createDeepSeekClaudeCodeEnv(process.env);

  console.log("[carvis] TypeScript runtime bootstrap ready");
  console.log(`[carvis] Claude Code base URL: ${claudeCodeEnv.ANTHROPIC_BASE_URL}`);
  console.log(`[carvis] Primary model: ${claudeCodeEnv.ANTHROPIC_MODEL}`);
}
