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
  fullscreen: boolean;
  kiosk: boolean;
  center: boolean;
  autoHideMenuBar: boolean;
  show: boolean;
  backgroundColor: string;
  webPreferences: {
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
    preload?: string;
  };
}

export interface ElectronBrowserWindow {
  webContents?: {
    send(channel: string, ...args: unknown[]): void;
  };
  loadFile(path: string): Promise<void> | void;
  once(eventName: "ready-to-show", listener: () => void): void;
  on?(eventName: "closed", listener: () => void): void;
  show(): void;
  isFullScreen?(): boolean;
  setFullScreen?(fullscreen: boolean): void;
  setKiosk?(kiosk: boolean): void;
}

export interface CreateElectronBrowserWindowOptions {
  electron: ElectronBrowserModule;
  outputDir: string;
  state: ElectronShellState;
  title?: string;
  width?: number;
  height?: number;
  fullscreen?: boolean;
  kiosk?: boolean;
  show?: boolean;
  preloadPath?: string;
}

export interface ElectronBrowserWindowResult {
  window: ElectronBrowserWindow;
  htmlPath: string;
}

export async function createElectronBrowserWindow(
  options: CreateElectronBrowserWindowOptions,
): Promise<ElectronBrowserWindowResult> {
  const snapshot = await writeElectronRendererSnapshot(options.outputDir, options.state);
  const fullscreen = options.fullscreen ?? process.env.CARVIS_ELECTRON_FULLSCREEN === "1";
  const kiosk = options.kiosk ?? fullscreen;
  const window = new options.electron.BrowserWindow({
    title: options.title ?? "Carvis",
    width: options.width ?? 1000,
    height: options.height ?? 640,
    minWidth: 900,
    minHeight: 600,
    fullscreen,
    kiosk,
    center: true,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#f4f6f8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: options.preloadPath,
    },
  });

  if (options.show !== false) {
    window.once("ready-to-show", () => {
      window.setFullScreen?.(fullscreen);
      window.setKiosk?.(kiosk);
      window.show();
    });
  }

  await window.loadFile(snapshot.htmlPath);

  return {
    window,
    htmlPath: snapshot.htmlPath,
  };
}
