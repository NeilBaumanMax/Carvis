import { app, BrowserWindow, ipcMain, shell as electronShell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMessageBus } from "../messagebus/index.js";
import { createElectronShell } from "./shell.js";
import type { ElectronShell } from "./shell.js";
import type { MessageBus } from "../messagebus/types.js";
import type { ElectronShellState } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let shell: ElectronShell | null = null;
let bus: MessageBus | null = null;
let statePollTimer: ReturnType<typeof setInterval> | null = null;

app.whenReady().then(() => {
  bus = createMessageBus();
  shell = createElectronShell(bus);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: "Carvis",
    backgroundColor: "#0f1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  registerIpcHandlers();

  statePollTimer = setInterval(pushStateToRenderer, 200);

  mainWindow.on("closed", () => {
    if (statePollTimer) {
      clearInterval(statePollTimer);
      statePollTimer = null;
    }
    mainWindow = null;
  });
});

app.on("window-all-closed", () => {
  shell?.dispose();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpcHandlers(): void {
  ipcMain.handle("shell:submitCommand", (_event, commandText: string, requestId?: string) => {
    shell?.submitCommand(commandText, { requestId });
  });

  ipcMain.handle("shell:getState", (): ElectronShellState | null => {
    return shell?.getState() ?? null;
  });

  ipcMain.handle("shell:openOutput", (_event, filePath: string) => {
    electronShell.openPath(filePath);
  });
}

function pushStateToRenderer(): void {
  if (mainWindow && !mainWindow.isDestroyed() && shell) {
    mainWindow.webContents.send("shell:stateUpdated", shell.getState());
  }
}
