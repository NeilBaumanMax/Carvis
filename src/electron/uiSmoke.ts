import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMessageBus } from "../messagebus/index.js";
import type { AgentRole } from "../shared/types/agent.js";
import type {
  AgentLifecyclePayload,
  AgentOutputPayload,
  OutputReadyPayload,
  RuntimeHeartbeatPayload,
} from "../shared/types/events.js";
import { createElectronShell, writeElectronRendererSnapshot } from "./index.js";

const bus = createMessageBus();
const shell = createElectronShell(bus);
const smokeRoot = await mkdtemp(join(tmpdir(), "carvis-electron-ui-"));
const roles: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];

try {
  await bus.publish<RuntimeHeartbeatPayload>({
    type: "runtime.heartbeat",
    source: "agentruntime",
    target: "electron",
    runId: "run-ui-smoke-1",
    payload: {
      activePidCount: 2,
      idlePidCount: 1,
      retainedPidCount: 2,
      queueDepth: 0,
    },
  });

  for (const [index, role] of roles.entries()) {
    await bus.publish<AgentLifecyclePayload>({
      type: "agent.ready",
      source: "agentruntime",
      target: "electron",
      runId: "run-ui-smoke-1",
      agentId: role,
      payload: {
        role,
        status: index === 4 ? "working" : "retained",
        pid: 42_000 + index,
        workplacePath: `workplaces/${role}`,
      },
    });

    await bus.publish<AgentOutputPayload>({
      type: "agent.output",
      source: "agentruntime",
      target: "electron",
      runId: "run-ui-smoke-1",
      agentId: role,
      payload: {
        stream: "stdout",
        text: `${role} ui smoke output`,
      },
    });
  }

  await bus.publish<OutputReadyPayload>({
    type: "output.ready",
    source: "agentruntime",
    target: "electron",
    runId: "run-ui-smoke-1",
    payload: {
      outputPath: "output/final-report.md",
      manifestPath: "output/manifest.json",
      gamePreviewPath: "output/game-preview.html",
    },
  });

  const snapshot = await writeElectronRendererSnapshot(smokeRoot, shell.getState());
  const html = await readFile(snapshot.htmlPath, "utf8");

  assert(html.includes('data-carvis-shell'), "HTML should include app root");
  assert(html.includes('data-command-form'), "HTML should include command form");
  assert(html.includes('class="command-input"'), "HTML should include command input");
  assert(html.includes('class="command-button"'), "HTML should include command button");
  assert(html.includes("@media (max-width: 620px)"), "HTML should include mobile layout rule");
  assert(html.includes("output/final-report.md"), "HTML should include output link");
  assert(html.includes("output/game-preview.html"), "HTML should include game preview link");
  assert(html.includes("Open Game"), "HTML should include game preview action");
  assert(html.includes("Open Folder"), "HTML should include folder action");

  for (const role of roles) {
    assert(html.includes(`data-role="${role}"`), `${role} panel should render`);
    assert(html.includes(`${role} ui smoke output`), `${role} output should render`);
  }

  console.log("[electron:ui-smoke] ok");
} finally {
  shell.dispose();
  await rm(smokeRoot, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
