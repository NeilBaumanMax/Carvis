import { mkdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMessageBus, type MessageBus } from "../messagebus/index.js";
import type { AgentRole } from "../shared/types/agent.js";
import type {
  AgentLifecyclePayload,
  AgentOutputPayload,
  OutputReadyPayload,
  RuntimeHeartbeatPayload,
} from "../shared/types/events.js";
import { createElectronShell } from "./shell.js";
import { createElectronBrowserWindow, type ElectronBrowserModule } from "./browserWindow.js";
import { writeElectronRendererPreload } from "./renderer.js";
import type { ElectronShellState } from "./types.js";

console.log("[electron:visual-smoke] boot");

interface ElectronVisualRuntime extends ElectronBrowserModule {
  app: {
    disableHardwareAcceleration(): void;
    whenReady(): Promise<void>;
    quit(): void;
  };
  ipcMain: {
    handle(channel: "carvis:get-state", listener: () => ElectronShellState): void;
    handle(channel: "carvis:submit-command", listener: (_event: unknown, commandText: string) => Promise<void>): void;
    handle(channel: "carvis:open-output", listener: (_event: unknown, outputPath: string) => Promise<string>): void;
  };
}

interface CapturableBrowserWindow {
  webContents: {
    send(channel: string, state: ElectronShellState): void;
    executeJavaScript(script: string): Promise<unknown>;
    capturePage(): Promise<{
      toPNG(): Buffer;
      getSize(): { width: number; height: number };
    }>;
  };
  isFullScreen(): boolean;
  isKiosk(): boolean;
  close(): void;
}

const require = createRequire(import.meta.url);
const electron = require("electron") as ElectronVisualRuntime;
const outputDir = process.env.CARVIS_ELECTRON_VISUAL_SMOKE_DIR ?? join(tmpdir(), "carvis-electron-visual-smoke");
const roles: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];

electron.app.disableHardwareAcceleration();
setTimeout(() => {
  console.error("[electron:visual-smoke] timed out");
  electron.app.quit();
  process.exit(1);
}, Number(process.env.CARVIS_ELECTRON_VISUAL_SMOKE_TIMEOUT_MS ?? 15_000)).unref();

console.log("[electron:visual-smoke] waiting for app ready");
void electron.app.whenReady().then(runVisualSmoke).catch((error: unknown) => {
  console.error(error);
  electron.app.quit();
  process.exit(1);
});

async function seedShellState(bus: MessageBus): Promise<void> {
  await bus.publish<RuntimeHeartbeatPayload>({
    type: "runtime.heartbeat",
    source: "agentruntime",
    target: "electron",
    runId: "run-electron-visual-smoke",
    payload: {
      activePidCount: 2,
      idlePidCount: 0,
      retainedPidCount: 3,
      queueDepth: 0,
    },
  });

  for (const [index, role] of roles.entries()) {
    await bus.publish<AgentLifecyclePayload>({
      type: "agent.ready",
      source: "agentruntime",
      target: "electron",
      runId: "run-electron-visual-smoke",
      agentId: role,
      payload: {
        role,
        status: index === roles.length - 1 ? "working" : "retained",
        pid: 50_000 + index,
        workplacePath: `workplaces/${role}`,
      },
    });
    await bus.publish<AgentOutputPayload>({
      type: "agent.output",
      source: "agentruntime",
      target: "electron",
      runId: "run-electron-visual-smoke",
      agentId: role,
      payload: {
        stream: "stdout",
        text: `${role} visual smoke output ready for screenshot validation`,
      },
    });
  }

  await bus.publish<OutputReadyPayload>({
    type: "output.ready",
    source: "agentruntime",
    target: "electron",
    runId: "run-electron-visual-smoke",
    payload: {
      outputPath: "output/final-report.md",
      manifestPath: "output/manifest.json",
      gamePreviewPath: "output/game-preview.html",
    },
  });
}

async function runVisualSmoke(): Promise<void> {
  console.log("[electron:visual-smoke] app ready");
  await mkdir(outputDir, { recursive: true });

  const bus = createMessageBus();
  const shell = createElectronShell(bus);
  let liveWindow: CapturableBrowserWindow | undefined;
  const openedOutputs: string[] = [];

  electron.ipcMain.handle("carvis:get-state", () => shell.getState());
  electron.ipcMain.handle("carvis:submit-command", async (_event, commandText) => {
    await shell.submitCommand(commandText);
  });
  electron.ipcMain.handle("carvis:open-output", async (_event, outputPath) => {
    openedOutputs.push(outputPath);
    return "";
  });
  shell.onStateChanged((state) => {
    liveWindow?.webContents.send("carvis:state", state);
  });

  try {
    await seedShellState(bus);
    console.log("[electron:visual-smoke] shell state seeded");
    const preload = await writeElectronRendererPreload(outputDir);

    const result = await createElectronBrowserWindow({
      electron,
      outputDir,
      state: shell.getState(),
      show: true,
      preloadPath: preload.preloadPath,
    });
    const window = result.window as unknown as CapturableBrowserWindow;
    liveWindow = window;

    console.log("[electron:visual-smoke] window loaded");
    await delay(1_000);
    const submitted = await window.webContents.executeJavaScript(`(async () => {
      const input = document.querySelector("input[name='command']");
      const form = document.querySelector("[data-command-form]");
      input.value = "visual smoke live submit";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 300));
      return input.value;
    })()`);

    assert(submitted === "", "visual smoke submit should clear command input");
    assert(
      shell.getState().submittedCommands.includes("visual smoke live submit"),
      "visual smoke submit should reach Electron shell",
    );

    await bus.publish<AgentOutputPayload>({
      type: "agent.output",
      source: "agentruntime",
      target: "electron",
      runId: "run-electron-visual-smoke",
      agentId: "manager",
      payload: {
        stream: "stdout",
        text: "manager live renderer update ok",
      },
    });
    await delay(300);
    const managerText = await window.webContents.executeJavaScript(
      `document.querySelector("[data-role='manager'] .latest")?.textContent`,
    );

    assert(
      typeof managerText === "string" && managerText.includes("manager live renderer update ok"),
      "visual smoke should live-update role output",
    );
    await window.webContents.executeJavaScript(
      `document.querySelector("[data-output-open]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))`,
    );
    await delay(300);
    assert(openedOutputs.includes("output/game-preview.html"), "visual smoke should request game preview open");

    const image = await window.webContents.capturePage();
    const png = image.toPNG();
    const imageSize = image.getSize();
    const pngPath = join(outputDir, "carvis-electron-visual-smoke.png");

    await writeFile(pngPath, png);
    console.log("[electron:visual-smoke] screenshot captured");
    const pngStat = await stat(pngPath);

    assert(result.htmlPath.endsWith("electron-shell.html"), "visual smoke should load renderer HTML");
    assert(window.isFullScreen(), "visual smoke window should be fullscreen");
    assert(window.isKiosk(), "visual smoke window should be kiosk fullscreen");
    assert(imageSize.width >= 1200, `screenshot width should look fullscreen, got ${imageSize.width}`);
    assert(imageSize.height >= 700, `screenshot height should look fullscreen, got ${imageSize.height}`);
    assert(pngStat.size > 10_000, `screenshot should be non-empty, got ${pngStat.size} bytes`);

    window.close();
    console.log(`[electron:visual-smoke] ok ${pngPath} ${imageSize.width}x${imageSize.height}`);
  } finally {
    shell.dispose();
    electron.app.quit();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
