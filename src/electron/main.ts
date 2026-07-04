import { app, BrowserWindow, ipcMain, shell as electronShell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createMessageBus } from "../messagebus/index.js";
import { createElectronShell } from "./shell.js";
import type { ElectronShell } from "./shell.js";
import type { MessageBus } from "../messagebus/types.js";
import type { ElectronShellState } from "./types.js";
import { applyKeysToEnv } from "../setup/keys.js";
import {
  createAgentPool,
  createHeartbeatTimer,
  createRuntimeBusClient,
  createTaskScheduler,
  defaultRuntimeConfig,
} from "../agentruntime/index.js";
import type { TaskScheduler, AgentPool, HeartbeatTimer, RuntimeBusClient } from "../agentruntime/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

let mainWindow: BrowserWindow | null = null;
let shell: ElectronShell | null = null;
let bus: MessageBus | null = null;
let scheduler: TaskScheduler | null = null;
let pool: AgentPool | null = null;
let heartbeat: HeartbeatTimer | null = null;
let statePollTimer: ReturnType<typeof setInterval> | null = null;

app.whenReady().then(() => {
  // --- 1. Apply API keys from keys.txt before any agent infrastructure ---
  applyKeysToEnv(PROJECT_ROOT);

  bus = createMessageBus();
  shell = createElectronShell(bus);

  // --- 2. Initialize agentruntime ---
  const config = defaultRuntimeConfig({
    executionMode: "claude",
    workplaceRoot: join(PROJECT_ROOT, ".carvis", "workplaces"),
    outputDir: join(PROJECT_ROOT, ".carvis", "output"),
    heartbeatIntervalMs: 500,
  });

  pool = createAgentPool(config);
  const busClient: RuntimeBusClient = createRuntimeBusClient(bus, () => scheduler?.getState().currentRunId);
  scheduler = createTaskScheduler(config, pool, busClient);
  heartbeat = createHeartbeatTimer(config, pool, busClient);

  // Start heartbeat so ElectronShell receives runtime.heartbeat events
  heartbeat.start(() => scheduler?.getState().currentRunId);

  // --- 3. Auto-advance pipeline when command is submitted ---
  busClient.subscribeToCommands((commandText: string, _requestId?: string) => {
    if (!scheduler) return;
    scheduler.submitTask(commandText);
    runPipeline();
  });

  // --- 4. Electron window ---
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
  heartbeat?.stop();
  scheduler?.shutdown();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// --- Auto-advance loop: step through all scheduler phases ---
async function runPipeline(): Promise<void> {
  if (!scheduler) return;

  const MAX_ADVANCES = 20;
  let advances = 0;
  let state = scheduler.getState();

  while (state.phase !== "shutdown" && advances < MAX_ADVANCES) {
    state = await scheduler.advance();
    advances += 1;
  }
}

// --- IPC handlers: mirroring previous interface ---
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
