import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRemoteMessageBus } from "../messagebus/index.js";
import { createElectronShell } from "./shell.js";
import { createElectronBrowserWindow, type ElectronBrowserModule } from "./browserWindow.js";

interface ElectronRuntimeModule extends ElectronBrowserModule {
  app: {
    whenReady(): Promise<void>;
    on(eventName: "window-all-closed" | "activate", listener: () => void): void;
    quit(): void;
  };
}

const require = createRequire(import.meta.url);
const electron = require("electron") as ElectronRuntimeModule;
const bus = createRemoteMessageBus({
  port: readPort(process.env.CARVIS_MESSAGEBUS_PORT),
});
const shell = createElectronShell(bus);
let openWindowCount = 0;

await electron.app.whenReady();
await openWindow();

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

  await createElectronBrowserWindow({
    electron,
    outputDir,
    state: shell.getState(),
  });
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
