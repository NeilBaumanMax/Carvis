import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRemoteMessageBus } from "../messagebus/index.js";
import { createElectronShell } from "./shell.js";
import { createElectronBrowserWindow, type ElectronBrowserModule } from "./browserWindow.js";
import { writeElectronRendererPreload } from "./renderer.js";
import type { ElectronShellState } from "./types.js";

interface ElectronRuntimeModule extends ElectronBrowserModule {
  app: {
    whenReady(): Promise<void>;
    on(eventName: "window-all-closed" | "activate", listener: () => void): void;
    quit(): void;
  };
  ipcMain: {
    handle(channel: "carvis:get-state", listener: () => ElectronShellState): void;
    handle(channel: "carvis:submit-command", listener: (_event: unknown, commandText: string) => Promise<void>): void;
    handle(channel: "carvis:open-output", listener: (_event: unknown, outputPath: string) => Promise<string>): void;
  };
  shell: {
    openPath(path: string): Promise<string>;
  };
}

const require = createRequire(import.meta.url);
const electron = require("electron") as ElectronRuntimeModule;
const bus = createRemoteMessageBus({
  port: readPort(process.env.CARVIS_MESSAGEBUS_PORT),
});
const shell = createElectronShell(bus);
const rendererTargets = new Set<{ send(channel: string, state: ElectronShellState): void }>();
const openedGamePreviewPaths = new Set<string>();
let openWindowCount = 0;

electron.ipcMain.handle("carvis:get-state", () => shell.getState());
electron.ipcMain.handle("carvis:submit-command", async (_event, commandText) => {
  await shell.submitCommand(commandText);
});
electron.ipcMain.handle("carvis:open-output", async (_event, outputPath) => electron.shell.openPath(outputPath));

shell.onStateChanged((state) => {
  for (const target of rendererTargets) {
    target.send("carvis:state", state);
  }
  void openLatestGamePreview(state);
});

void electron.app.whenReady().then(async () => {
  await delay(readStartDelayMs(process.env.CARVIS_ELECTRON_START_DELAY_MS));
  await openWindow();
});

electron.app.on("activate", () => {
  if (openWindowCount === 0) {
    void openWindow();
  }
});

electron.app.on("window-all-closed", () => {
  shell.dispose();
  bus.close();
  electron.app.quit();
});

async function openWindow(): Promise<void> {
  openWindowCount += 1;
  const outputDir =
    process.env.CARVIS_ELECTRON_RENDERER_DIR ??
    (await mkdtemp(join(tmpdir(), "carvis-electron-browser-")));
  const preload = await writeElectronRendererPreload(outputDir);

  const result = await createElectronBrowserWindow({
    electron,
    outputDir,
    state: shell.getState(),
    preloadPath: preload.preloadPath,
  });
  const target = result.window.webContents;

  if (target !== undefined) {
    rendererTargets.add(target);
    target.send("carvis:state", shell.getState());
    result.window.on?.("closed", () => {
      rendererTargets.delete(target);
      openWindowCount = Math.max(0, openWindowCount - 1);
    });
  }
}

async function openLatestGamePreview(state: ElectronShellState): Promise<void> {
  if (process.env.CARVIS_AUTO_OPEN_GAME_PREVIEW === "0") {
    return;
  }

  const gamePreviewPath = state.outputs.at(-1)?.gamePreviewPath;

  if (gamePreviewPath === undefined || openedGamePreviewPaths.has(gamePreviewPath)) {
    return;
  }

  openedGamePreviewPaths.add(gamePreviewPath);
  const errorMessage = await openGamePreviewPath(gamePreviewPath);

  if (errorMessage.length > 0) {
    console.error(`[electron] failed to open game preview ${gamePreviewPath}: ${errorMessage}`);
  }
}

async function openGamePreviewPath(gamePreviewPath: string): Promise<string> {
  const browserCommand = process.env.CARVIS_GAME_PREVIEW_BROWSER_CMD;

  if (browserCommand === undefined || browserCommand.length === 0) {
    return electron.shell.openPath(gamePreviewPath);
  }

  try {
    const child = spawn(browserCommand, [gamePreviewPath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function readPort(value: string | undefined): number {
  if (value === undefined) {
    return 45931;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isFinite(port) || port <= 0) {
    return 45931;
  }

  return port;
}

function readStartDelayMs(value: string | undefined): number {
  if (value === undefined) {
    return 8_000;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 8_000;
  }

  return parsed;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
