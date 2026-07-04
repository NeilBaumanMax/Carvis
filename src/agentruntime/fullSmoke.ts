import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMessageBus } from "../messagebus/index.js";
import type { OutputReadyPayload } from "../shared/types/events.js";
import { createAgentRuntime } from "./index.js";

const workspaceRoot = await mkdtemp(join(tmpdir(), "carvis-full-workplaces-"));
const outputRoot = await mkdtemp(join(tmpdir(), "carvis-full-output-"));
const bus = createMessageBus();
const runtime = createAgentRuntime(workspaceRoot, outputRoot);
const outputs: OutputReadyPayload[] = [];

bus.subscribe<OutputReadyPayload>(
  {
    type: "output.ready",
    target: "electron",
  },
  (event) => {
    outputs.push(event.payload);
  },
);

try {
  const result = await runtime.runCommand(bus, "create a complete Carvis smoke output", {
    ...process.env,
    CARVIS_CLAUDE_MODE: "mock",
  });

  const writerOutput = await runtime.readRoleOutput("writer");
  const finalReport = await readFile(result.outputPath, "utf8");

  assert(writerOutput.includes("writer mock result"), "writer output should be written");
  assert(finalReport.includes("Carvis Final Report"), "final report should be written");
  assert(outputs[0]?.manifestPath?.endsWith("manifest.json") === true, "output ready should include manifest");

  console.log("[full:smoke] ok");
} finally {
  await rm(workspaceRoot, { recursive: true, force: true });
  await rm(outputRoot, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
