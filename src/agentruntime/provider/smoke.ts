import { getRoleProviderConfig } from "./roles.js";
import { runQwenOpenAiText } from "./qwenOpenAi.js";

assert(getRoleProviderConfig("manager").provider === "deepseek-claudecode", "manager should use DeepSeek");
assert(getRoleProviderConfig("engineer").provider === "deepseek-claudecode", "engineer should use DeepSeek");
assert(getRoleProviderConfig("writer").provider === "qwen-openai", "writer should use Qwen");
assert(getRoleProviderConfig("artist").provider === "qwen-openai", "artist should use Qwen");
assert(getRoleProviderConfig("researcher").provider === "qwen-openai", "researcher should use Qwen");

if (process.env.CARVIS_QWEN_REAL_SMOKE === "1") {
  const output = await runQwenOpenAiText({
    systemPrompt: "你是一个 smoke test responder。",
    userPrompt: "请只回复：qwen real smoke ok",
    timeoutMs: 120_000,
  });

  assert(output.includes("qwen real smoke ok"), `unexpected qwen output: ${output}`);
  console.log("[provider:smoke] qwen real ok");
}

console.log("[provider:smoke] ok");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
