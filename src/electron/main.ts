import { createRemoteMessageBus } from "../messagebus/index.js";
import { runComponentMain } from "../shared/componentMain.js";
import { createElectronShell, writeElectronRendererSnapshot } from "./index.js";

const bus = createRemoteMessageBus({
  port: readPort(process.env.CARVIS_MESSAGEBUS_PORT),
});
const shell = createElectronShell(bus);

await runComponentMain({
  name: "electron",
  onStart: async () => {
    const state = shell.getState();
    console.log(`[electron] panels=${state.panels.map((panel) => panel.role).join(",")}`);

    if (process.env.CARVIS_ELECTRON_SUBMIT_ON_START !== undefined) {
      await shell.submitCommand(process.env.CARVIS_ELECTRON_SUBMIT_ON_START, {
        requestId: process.env.CARVIS_ELECTRON_REQUEST_ID,
        speedMode: readSpeedMode(process.env.CARVIS_SPEED_MODE),
      });
      console.log("[electron] submitted startup command");
    }

    if (process.env.CARVIS_ELECTRON_RENDERER_DIR !== undefined) {
      const snapshot = await writeElectronRendererSnapshot(
        process.env.CARVIS_ELECTRON_RENDERER_DIR,
        shell.getState(),
      );
      console.log(`[electron] renderer snapshot ${snapshot.htmlPath}`);
    }
  },
  onShutdown: () => {
    shell.dispose();
    bus.close();
  },
});

shell.dispose();
bus.close();

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

function readSpeedMode(value: string | undefined): "auto" | "fast" | "full" | undefined {
  return value === "auto" || value === "fast" || value === "full" ? value : undefined;
}
