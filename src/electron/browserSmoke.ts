import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMessageBus } from "../messagebus/index.js";
import { createElectronShell } from "./shell.js";
import {
  createElectronBrowserWindow,
  type ElectronBrowserModule,
  type ElectronBrowserWindowConstructorOptions,
} from "./browserWindow.js";

const calls: {
  options?: ElectronBrowserWindowConstructorOptions;
  loadedFile?: string;
  shown: boolean;
  fullscreen: boolean;
  kiosk: boolean;
} = {
  shown: false,
  fullscreen: false,
  kiosk: false,
};

class FakeBrowserWindow {
  constructor(options: ElectronBrowserWindowConstructorOptions) {
    calls.options = options;
    calls.fullscreen = options.fullscreen;
    calls.kiosk = options.kiosk;
  }

  loadFile(path: string): void {
    calls.loadedFile = path;
  }

  once(eventName: "ready-to-show", listener: () => void): void {
    assert(eventName === "ready-to-show", "window should wait for ready-to-show before show");
    listener();
  }

  show(): void {
    calls.shown = true;
  }

  isFullScreen(): boolean {
    return calls.fullscreen;
  }

  setFullScreen(fullscreen: boolean): void {
    calls.fullscreen = fullscreen;
  }

  setKiosk(kiosk: boolean): void {
    calls.kiosk = kiosk;
  }
}

const electron: ElectronBrowserModule = {
  BrowserWindow: FakeBrowserWindow,
};
const bus = createMessageBus();
const shell = createElectronShell(bus);
const smokeRoot = await mkdtemp(join(tmpdir(), "carvis-electron-browser-"));

try {
  const result = await createElectronBrowserWindow({
    electron,
    outputDir: smokeRoot,
    state: shell.getState(),
  });
  const html = await readFile(result.htmlPath, "utf8");

  assert(calls.options?.title === "Carvis", "BrowserWindow should use Carvis title");
  assert(calls.options?.width === 1280, "BrowserWindow should use desktop width");
  assert(calls.options?.height === 820, "BrowserWindow should use desktop height");
  assert(calls.options?.minWidth === 900, "BrowserWindow should enforce minimum width");
  assert(calls.options?.fullscreen === true, "BrowserWindow should default to fullscreen");
  assert(calls.options?.kiosk === true, "BrowserWindow should default to kiosk fullscreen");
  assert(calls.options?.autoHideMenuBar === true, "BrowserWindow should hide menu bar");
  assert(calls.options?.webPreferences.contextIsolation === true, "contextIsolation should be enabled");
  assert(calls.options?.webPreferences.nodeIntegration === false, "nodeIntegration should be disabled");
  assert(calls.options?.webPreferences.sandbox === true, "sandbox should be enabled");
  assert(calls.loadedFile === result.htmlPath, "BrowserWindow should load rendered HTML file");
  assert(calls.shown, "BrowserWindow should show after ready-to-show");
  assert(calls.fullscreen, "BrowserWindow should be set fullscreen before show");
  assert(calls.kiosk, "BrowserWindow should be set kiosk before show");
  assert(html.includes("data-carvis-shell"), "loaded HTML should contain Carvis shell");
  assert(html.includes("data-role=\"manager\""), "loaded HTML should render role panels");

  console.log("[electron:browser-smoke] ok");
} finally {
  shell.dispose();
  await rm(smokeRoot, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
