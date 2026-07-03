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
    preloadPath: join(smokeRoot, "preload.cjs"),
  });
  const html = await readFile(result.htmlPath, "utf8");

  assert(calls.options?.title === "Carvis", "BrowserWindow should use Carvis title");
  assert(calls.options?.width === 1000, "BrowserWindow should use compact 1000px width");
  assert(calls.options?.height === 640, "BrowserWindow should use compact 640px height");
  assert(calls.options?.minWidth === 900, "BrowserWindow should enforce minimum width");
  assert(calls.options?.fullscreen === true, "BrowserWindow should default to fullscreen mode");
  assert(calls.options?.kiosk === false, "BrowserWindow should default to non-kiosk mode");
  assert(calls.options?.center === true, "BrowserWindow should open centered");
  assert(calls.options?.autoHideMenuBar === true, "BrowserWindow should hide menu bar");
  assert(calls.options?.webPreferences.contextIsolation === true, "contextIsolation should be enabled");
  assert(calls.options?.webPreferences.nodeIntegration === false, "nodeIntegration should be disabled");
  assert(calls.options?.webPreferences.sandbox === true, "sandbox should be enabled");
  assert(
    calls.options?.webPreferences.preload?.endsWith("preload.cjs") === true,
    "BrowserWindow should receive preload path",
  );
  assert(calls.loadedFile === result.htmlPath, "BrowserWindow should load rendered HTML file");
  assert(calls.shown, "BrowserWindow should show after ready-to-show");
  assert(calls.fullscreen, "BrowserWindow should enter fullscreen before show");
  assert(!calls.kiosk, "BrowserWindow should stay out of kiosk mode before show");
  assert(result.htmlPath.endsWith("dist/electron/carvisui/index.html"), "BrowserWindow should load built carvisui");
  assert(html.includes("<title>Carvis</title>"), "loaded HTML should use Carvis title");
  assert(html.includes('id="root"'), "loaded HTML should contain React root");
  assert(html.includes("./assets/index-"), "loaded HTML should reference built UI assets");

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
