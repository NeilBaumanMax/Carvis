import {
  createClaudeCodeCommand,
  createDeepSeekClaudeCodeEnv,
  hasDeepSeekClaudeCodeToken,
  runClaudeCodePrint,
} from "./index.js";

const env = process.env;
const deepseekEnv = createDeepSeekClaudeCodeEnv(env);
const command = createClaudeCodeCommand(["--version"], env);

assert(
  deepseekEnv.ANTHROPIC_BASE_URL === "https://api.deepseek.com/anthropic",
  "DeepSeek Anthropic base URL should be the official endpoint",
);
assert(deepseekEnv.ANTHROPIC_MODEL.length > 0, "main model should be configured");
assert(command.command.length > 0, "claude command should be configured");

if (env.CARVIS_CLAUDECODE_REAL_SMOKE !== "1") {
  console.log("[claudecode:smoke] ok (dry)");
  process.exit(0);
}

assert(
  hasDeepSeekClaudeCodeToken(env),
  "real smoke requires ANTHROPIC_AUTH_TOKEN or DEEPSEEK_API_KEY",
);

const expected = "carvis deepseek claude code ok";
const result = await runClaudeCodePrint(`Reply exactly: ${expected}`, {
  env,
  model: env.CARVIS_CLAUDECODE_SMOKE_MODEL ?? "deepseek-v4-flash",
  maxBudgetUsd: env.CARVIS_CLAUDECODE_SMOKE_MAX_BUDGET_USD ?? "0.20",
});

assert(result.exitCode === 0, `claude exited with ${String(result.exitCode)}: ${result.stderr}`);
assert(
  result.stdout.trim() === expected,
  `expected ${expected}, got ${result.stdout.trim()}`,
);

console.log("[claudecode:smoke] ok (real)");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
