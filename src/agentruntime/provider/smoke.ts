import { getRoleProviderConfig } from "./roles.js";
import { runQwenOpenAiText } from "./qwenOpenAi.js";

assert(getRoleProviderConfig("manager").provider === "deepseek-claudecode", "manager should use DeepSeek");
assert(getRoleProviderConfig("engineer").provider === "deepseek-claudecode", "engineer should use DeepSeek");
assert(getRoleProviderConfig("writer").provider === "deepseek-claudecode", "writer should use DeepSeek");
assert(getRoleProviderConfig("artist").provider === "qwen-openai", "artist should use Qwen");
assert(getRoleProviderConfig("researcher").provider === "deepseek-openai", "researcher should use DeepSeek API");
assert(getRoleProviderConfig("researcher").defaultModel === "deepseek-chat", "researcher should default to DeepSeek chat API");

for (const role of ["manager", "writer", "artist", "researcher", "engineer"] as const) {
  assert(
    getRoleProviderConfig(role, { CARVIS_PROVIDER_MODE: "all-deepseek" }).provider === "deepseek-claudecode",
    `${role} should use DeepSeek in all-deepseek mode`,
  );
}

if (process.env.CARVIS_QWEN_REAL_SMOKE === "1") {
  const output = await runQwenOpenAiText({
    systemPrompt: "你是一个 smoke test responder。",
    userPrompt: "请只回复：qwen real smoke ok",
    timeoutMs: 120_000,
  });

  assert(output.content.includes("qwen real smoke ok"), `unexpected qwen output: ${output.content}`);
  console.log("[provider:smoke] qwen real ok");
}

console.log("[provider:smoke] ok");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
