import { PersistentPidAgentPool } from "./index.js";

const pool = new PersistentPidAgentPool({
  createCommand: () => ({
    command: "node",
    args: ["dist/agentruntime/pidagent/mockWorker.js"],
  }),
});
const sharedPool = new PersistentPidAgentPool({
  agentKey: (role) => (role === "engineer" || role === "writer" ? "writer-engineer" : role),
  createCommand: () => ({
    command: "node",
    args: ["dist/agentruntime/pidagent/mockWorker.js"],
  }),
});

try {
  const manager = pool.getAgent("manager");
  const first = await manager.runTask({
    input: "plan first",
  });
  const second = await manager.runTask({
    input: "plan second",
  });
  const writer = pool.getAgent("writer");
  const writerResult = await writer.runTask({
    input: "write once",
  });

  assert(first.pid > 0, "manager PID should be captured");
  assert(first.pid === second.pid, "manager PID should be reused between tasks");
  assert(first.output === "manager:plan first", "manager first output should match");
  assert(second.output === "manager:plan second", "manager second output should match");
  assert(manager.retained, "manager should be retained after task");
  assert(writerResult.pid > 0, "writer PID should be captured");
  assert(writerResult.pid !== manager.pid, "writer should use a separate PID");
  assert(writer.retained, "writer should be retained after task");
  assert(pool.getAgents().length === 2, "pool should keep two retained agents");

  const sharedWriter = sharedPool.getAgent("writer");
  const sharedEngineer = sharedPool.getAgent("engineer");
  const sharedWriterResult = await sharedWriter.runTask({ input: "writer phase" });
  const sharedEngineerResult = await sharedEngineer.runTask({ input: "engineer phase" });

  assert(sharedWriter.pid === sharedEngineer.pid, "writer and engineer should be able to share one worker PID");
  assert(sharedWriterResult.pid === sharedEngineerResult.pid, "shared worker should report the same PID for both roles");

  await pool.shutdown();
  await sharedPool.shutdown();
  assert(pool.getAgents().length === 0, "pool should be empty after shutdown");
  assert(sharedPool.getAgents().length === 0, "shared pool should be empty after shutdown");

  console.log("[pidagent:smoke] ok");
} finally {
  await pool.shutdown();
  await sharedPool.shutdown();
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
