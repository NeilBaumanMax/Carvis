import type { ElectronShellState } from "./types.js";
import { writeElectronRendererSnapshot } from "./renderer.js";

export interface ElectronBrowserModule {
  BrowserWindow: new (options: ElectronBrowserWindowConstructorOptions) => ElectronBrowserWindow;
  screen?: {
    getPrimaryDisplay(): {
      workArea: { x: number; y: number; width: number; height: number };
    };
  };
}

export interface ElectronBrowserWindowConstructorOptions {
  title: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
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
  const bounds = fitWindowToWorkArea(options.electron, options.width ?? 1000, options.height ?? 640);
  const window = new options.electron.BrowserWindow({
    title: options.title ?? "Carvis",
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: Math.min(600, bounds.height),
    fullscreen,
    kiosk,
    center: bounds.x === undefined || bounds.y === undefined,
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

export function fitWindowToWorkArea(
  electron: ElectronBrowserModule,
  preferredWidth: number,
  preferredHeight: number,
): { width: number; height: number; x?: number; y?: number } {
  const workArea = electron.screen?.getPrimaryDisplay().workArea;

  if (workArea === undefined) {
    return {
      width: preferredWidth,
      height: preferredHeight,
    };
  }

  const margin = 16;
  const width = Math.min(preferredWidth, Math.max(320, workArea.width - margin));
  const height = Math.min(preferredHeight, Math.max(320, workArea.height - margin));

  return {
    width,
    height,
    x: workArea.x + Math.floor((workArea.width - width) / 2),
    y: workArea.y + Math.floor((workArea.height - height) / 2),
  };
}
