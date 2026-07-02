import { createAgentRuntime } from "../agentruntime/index.js";
import { PersistentPidAgentPool } from "../agentruntime/pidagent/index.js";
import { createElectronShell } from "../electron/index.js";
import { createMessageBus } from "../messagebus/index.js";

const bus = createMessageBus();
const pool = new PersistentPidAgentPool({
  createCommand: () => ({
    command: "node",
    args: ["dist/agentruntime/pidagent/mockWorker.js"],
  }),
});
const runtime = createAgentRuntime(bus, {
  pidAgentPool: pool,
  pidTaskTimeoutMs: 5_000,
});
const shell = createElectronShell(bus);

try {
  runtime.start();

  await shell.submitCommand("run through persistent pid agents", {
    requestId: "req-runtime-pid-agent-smoke-1",
  });

  const state = shell.getState();
  const snapshot = runtime.getSnapshot();
  const runtimePids = snapshot.agents.map((agent) => agent.pid);
  const pooledAgents = pool.getAgents();

  assert(pooledAgents.length === 5, "pid agent pool should keep all five retained agents after run");
  assert(state.runtime.retainedPidCount === 5, "runtime should retain all five pids after run");
  assert(snapshot.agents.every((agent) => agent.status === "retained"), "all runtime agents should be retained");
  assert(runtimePids.every((pid) => pid !== undefined && pid > 0), "all runtime agents should expose real pids");
  assert(
    runtimePids.every((pid) => pid !== undefined && (pid < 40_000 || pid > 40_004)),
    "runtime should use child process pids instead of simulated pid counter",
  );

  for (const role of ["manager", "writer", "artist", "researcher", "engineer"] as const) {
    const panel = state.panels.find((item) => item.role === role);

    assert(panel?.status === "retained", `${role} panel should be retained`);
    assert(panel.pid !== undefined && panel.pid > 0, `${role} panel should show pid`);
    assert(
      panel.latestOutput?.includes(`${role}:${role}: run through persistent pid agents`) === true,
      `${role} output should come from pid agent`,
    );
  }

  console.log("[runtime-pidagent:smoke] ok");
} finally {
  await pool.shutdown();
  runtime.dispose();
  shell.dispose();
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
