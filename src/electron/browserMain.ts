import { createRequire } from "node:module";
import { access, mkdtemp, readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createRemoteMessageBus } from "../messagebus/index.js";
import { createElectronShell } from "./shell.js";
import { createElectronBrowserWindow, fitWindowToWorkArea, type ElectronBrowserModule } from "./browserWindow.js";
import { writeElectronRendererPreload } from "./renderer.js";
import { startElectronRemoteApi, type ElectronRemoteApiHandle } from "./remoteApi.js";
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
const gamePreviewWindows = new Set<InstanceType<ElectronRuntimeModule["BrowserWindow"]>>();
const openedGamePreviewPaths = new Set<string>();
let openWindowCount = 0;
let isBackfillingOutput = false;
let remoteApi: ElectronRemoteApiHandle | undefined;

electron.ipcMain.handle("carvis:get-state", () => shell.getState());
electron.ipcMain.handle("carvis:submit-command", async (_event, commandText) => {
  await shell.submitCommand(commandText);
});
electron.ipcMain.handle("carvis:open-output", async (_event, outputPath) => electron.shell.openPath(outputPath));

shell.onStateChanged((state) => {
  for (const target of rendererTargets) {
    target.send("carvis:state", state);
  }
  if (!isBackfillingOutput) {
    void openLatestGamePreview(state);
  }
});

void electron.app.whenReady().then(async () => {
  await delay(readStartDelayMs(process.env.CARVIS_ELECTRON_START_DELAY_MS));
  remoteApi = await startElectronRemoteApi(shell);
  await openWindow();
  await backfillExistingOutput();
});

electron.app.on("activate", () => {
  if (openWindowCount === 0) {
    void openWindow();
  }
});

electron.app.on("window-all-closed", () => {
  void remoteApi?.close();
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
  if (process.env.CARVIS_AUTO_OPEN_GAME_PREVIEW !== "1") {
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

async function backfillExistingOutput(): Promise<void> {
  if (process.env.CARVIS_ELECTRON_BACKFILL_OUTPUT === "0") {
    return;
  }

  const outputRoot = resolve(process.env.CARVIS_OUTPUT_ROOT ?? join("output", "runs"));
  const outputRoots = await findOutputRoots(outputRoot);

  isBackfillingOutput = true;
  try {
    for (const runOutputRoot of outputRoots) {
      const outputPath = join(runOutputRoot, "final-report.md");
      const runManifestPath = join(runOutputRoot, "manifest.json");
      const rootManifestPath = join(outputRoot, "manifest.json");
      const gamePreviewPath = join(runOutputRoot, "game-preview.html");

      if (!(await pathExists(outputPath))) {
        continue;
      }

      await shell.registerOutputReady({
        outputPath,
        manifestPath: (await pathExists(runManifestPath))
          ? runManifestPath
          : (await pathExists(rootManifestPath))
            ? rootManifestPath
            : undefined,
        gamePreviewPath: (await pathExists(gamePreviewPath)) ? gamePreviewPath : undefined,
      });
    }
  } finally {
    isBackfillingOutput = false;
  }
}

async function findOutputRoots(outputRoot: string): Promise<string[]> {
  if (await pathExists(join(outputRoot, "final-report.md"))) {
    return [outputRoot];
  }

  let entries: string[];
  try {
    entries = await readdir(outputRoot);
  } catch {
    return [];
  }

  const candidates = await Promise.all(
    entries.map(async (entry) => {
      const path = join(outputRoot, entry);

      try {
        const info = await stat(path);

        return info.isDirectory() && (await pathExists(join(path, "final-report.md")))
          ? { path, mtimeMs: info.mtimeMs }
          : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  return candidates
    .filter((candidate): candidate is { path: string; mtimeMs: number } => candidate !== undefined)
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
    .map((candidate) => candidate.path);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function openGamePreviewPath(gamePreviewPath: string): Promise<string> {
  const browserCommand = process.env.CARVIS_GAME_PREVIEW_BROWSER_CMD;

  if (browserCommand === undefined || browserCommand.length === 0) {
    return openGamePreviewWindow(gamePreviewPath);
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

async function openGamePreviewWindow(gamePreviewPath: string): Promise<string> {
  try {
    const bounds = fitWindowToWorkArea(electron, 1000, 640);
    const window = new electron.BrowserWindow({
      title: "Carvis Game Preview",
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      minWidth: 720,
      minHeight: Math.min(480, bounds.height),
      fullscreen: false,
      kiosk: false,
      center: bounds.x === undefined || bounds.y === undefined,
      autoHideMenuBar: true,
      show: false,
      backgroundColor: "#000000",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    gamePreviewWindows.add(window);
    window.on?.("closed", () => {
      gamePreviewWindows.delete(window);
    });
    window.once("ready-to-show", () => {
      window.setFullScreen?.(false);
      window.setKiosk?.(false);
      window.show();
    });
    await window.loadFile(gamePreviewPath);

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
