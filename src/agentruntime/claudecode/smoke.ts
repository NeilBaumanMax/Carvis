import { createMessageBus } from "../../messagebus/index.js";
import type { AgentOutputPayload } from "../../shared/types/events.js";
import { runClaudeCodeAgent } from "./agent.js";

const bus = createMessageBus();
const streamed: string[] = [];
const realMode = process.env.CARVIS_CLAUDE_MODE === "real";

bus.subscribe<AgentOutputPayload>(
  {
    type: "agent.output.stream",
    target: "electron",
  },
  (event) => {
    streamed.push(event.payload.text);
  },
);

const result = await runClaudeCodeAgent({
  role: "writer",
  prompt: "Write one smoke line.",
  command: realMode ? undefined : process.execPath,
  args: realMode
    ? undefined
    : [
        "-e",
        "let input=''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => { process.stdout.write('mock claude received: ' + input.split('\\n').at(-3)); });",
      ],
  bus,
  runId: "run-claudecode-smoke",
  requestId: "req-claudecode-smoke",
  agentId: "writer",
});

assert(result.exitCode === 0, "claudecode smoke should exit cleanly");
assert(result.stdout.length > 0, "claudecode smoke should capture stdout");
assert(streamed.join("").length > 0, "claudecode smoke should stream stdout through messagebus");

console.log("[claudecode:smoke] ok");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
