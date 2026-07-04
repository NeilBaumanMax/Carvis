import { createMessageBus } from "../messagebus/index.js";
import { waitForShutdown } from "../shared/process/lifecycle.js";
import { createElectronShell } from "./index.js";

const bus = createMessageBus();
const shell = createElectronShell(bus);
const roles = shell.getState().panels.map((panel) => panel.role).join(", ");

console.log("[electron] mock shell ready");
console.log(`[electron] workplace panels: ${roles}`);

await waitForShutdown("electron");

shell.dispose();
