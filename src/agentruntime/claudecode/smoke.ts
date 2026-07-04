import { spawnClaudeCode, isClaudeCodeAvailable, mergeClaudeCodeEnv } from "./index.js";

// --- Test 1: stdout capture ---
console.log("[Test 1] stdout capture");

const stdoutProcess = spawnClaudeCode({
  command: "echo",
  args: ["hello-from-claudecode-smoke"],
});

const stdoutLines: string[] = [];
stdoutProcess.onStdoutLine((line) => {
  stdoutLines.push(line);
});

const stdoutExit = await new Promise<{ code: number | null }>((resolve) => {
  stdoutProcess.onExit((code) => resolve({ code }));
});

assert(
  stdoutLines.some((l) => l.includes("hello-from-claudecode-smoke")),
  "stdout should contain expected output",
);
assert(stdoutExit.code === 0, "exit code should be 0");
assert(stdoutProcess.pid !== undefined, "pid should be defined");

console.log("[Test 1] ok");

// --- Test 2: stderr capture ---
console.log("[Test 2] stderr capture");

const stderrProcess = spawnClaudeCode({
  command: "node",
  args: ["-e", "console.error('stderr-message-for-smoke')"],
});

const stderrLines: string[] = [];
stderrProcess.onStderrLine((line) => {
  stderrLines.push(line);
});

const stderrExit = await new Promise<{ code: number | null }>((resolve) => {
  stderrProcess.onExit((code) => resolve({ code }));
});

assert(
  stderrLines.some((l) => l.includes("stderr-message-for-smoke")),
  "stderr should contain expected error output",
);
assert(stderrExit.code === 0, "exit code should be 0");

console.log("[Test 2] ok");

// --- Test 3: non-zero exit code classification ---
console.log("[Test 3] non-zero exit code");

const failProcess = spawnClaudeCode({
  command: "node",
  args: ["-e", "process.exit(42)"],
});

let failExitCode: number | null = null;
failProcess.onExit((code) => {
  failExitCode = code;
});

await new Promise<void>((resolve) => {
  failProcess.onExit(() => resolve());
});

assert(failExitCode === 42, `non-zero exit code should be captured, got ${failExitCode}`);

console.log("[Test 3] ok");

// --- Test 4: timeout detection ---
console.log("[Test 4] timeout detection");

const timeoutProcess = spawnClaudeCode({
  command: "node",
  args: ["-e", "setTimeout(() => {}, 10000)"],
  timeoutMs: 500,
});

let timeoutError: Error | undefined;
timeoutProcess.onError((err) => {
  timeoutError = err;
});

let timeoutExitCode: number | null | undefined;
timeoutProcess.onExit((code) => {
  timeoutExitCode = code;
});

await new Promise<void>((resolve) => {
  timeoutProcess.onExit(() => resolve());
});

assert(
  timeoutError !== undefined && timeoutError.message.includes("timed out"),
  `timeout error should be emitted, got: ${timeoutError?.message}`,
);

console.log("[Test 4] ok");

// --- Test 5: stdin write ---
console.log("[Test 5] stdin write");

const stdinProcess = spawnClaudeCode({
  command: "node",
  args: ["-e", "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(d))"],
});

const stdinLines: string[] = [];
stdinProcess.onStdoutLine((line) => {
  stdinLines.push(line);
});

stdinProcess.writeInput("test-input-123\n");
stdinProcess.closeStdin();

await new Promise<void>((resolve) => {
  stdinProcess.onExit(() => resolve());
});

assert(
  stdinLines.some((l) => l.includes("test-input-123")),
  `stdin should be written and echoed back, got lines: ${stdinLines.join(" | ")}`,
);

console.log("[Test 5] ok");

// --- Test 6: kill signal ---
console.log("[Test 6] kill signal");

const killProcess = spawnClaudeCode({
  command: "node",
  args: ["-e", "setTimeout(() => {}, 60000)"],
});

let killSignal: NodeJS.Signals | null | undefined;
killProcess.onExit((_code, signal) => {
  killSignal = signal;
});

setTimeout(() => {
  killProcess.kill("SIGTERM");
}, 100);

await new Promise<void>((resolve) => {
  killProcess.onExit(() => resolve());
});

assert(killSignal === "SIGTERM", `kill signal should be SIGTERM, got ${killSignal}`);

console.log("[Test 6] ok");

// --- Test 7: token check ---
console.log("[Test 7] token check");

// Without ANTHROPIC_AUTH_TOKEN set, isClaudeCodeAvailable should return false
const hasToken = isClaudeCodeAvailable();
console.log(`[Test 7] hasToken=${hasToken} (no assertion, depends on env)`);

// mergeClaudeCodeEnv should always produce a valid object with default values
const env = mergeClaudeCodeEnv({});
assert(
  env.ANTHROPIC_BASE_URL !== undefined,
  "ANTHROPIC_BASE_URL should have default",
);
assert(
  env.ANTHROPIC_BASE_URL === "https://api.deepseek.com/anthropic",
  "ANTHROPIC_BASE_URL should default to DeepSeek",
);
assert(
  env.ANTHROPIC_MODEL !== undefined,
  "ANTHROPIC_MODEL should have default",
);

console.log("[Test 7] ok");

console.log("[claudecode:smoke] ok");

// --- Helpers ---
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[claudecode:smoke] FAIL: ${message}`);
  }
}
