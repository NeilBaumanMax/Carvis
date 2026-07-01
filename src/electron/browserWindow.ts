import type { ElectronShellState } from "./types.js";
import { writeElectronRendererSnapshot } from "./renderer.js";

export interface ElectronBrowserModule {
  BrowserWindow: new (options: ElectronBrowserWindowConstructorOptions) => ElectronBrowserWindow;
}

export interface ElectronBrowserWindowConstructorOptions {
  title: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  show: boolean;
  backgroundColor: string;
  webPreferences: {
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
  };
}

export interface ElectronBrowserWindow {
  loadFile(path: string): Promise<void> | void;
  once(eventName: "ready-to-show", listener: () => void): void;
  show(): void;
}

export interface CreateElectronBrowserWindowOptions {
  electron: ElectronBrowserModule;
  outputDir: string;
  state: ElectronShellState;
  title?: string;
  width?: number;
  height?: number;
  show?: boolean;
}

export interface ElectronBrowserWindowResult {
  window: ElectronBrowserWindow;
  htmlPath: string;
}

export async function createElectronBrowserWindow(
  options: CreateElectronBrowserWindowOptions,
): Promise<ElectronBrowserWindowResult> {
  const snapshot = await writeElectronRendererSnapshot(options.outputDir, options.state);
  const window = new options.electron.BrowserWindow({
    title: options.title ?? "Carvis",
    width: options.width ?? 1280,
    height: options.height ?? 820,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: "#f4f6f8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (options.show !== false) {
    window.once("ready-to-show", () => {
      window.show();
    });
  }

  await window.loadFile(snapshot.htmlPath);

  return {
    window,
    htmlPath: snapshot.htmlPath,
  };
}
