import { createRemoteMessageBus } from "../messagebus/index.js";
import { runComponentMain } from "../shared/componentMain.js";
import { createAgentRuntime } from "./index.js";

const bus = createRemoteMessageBus({
  port: readPort(process.env.CARVIS_MESSAGEBUS_PORT),
});
const runtime = createAgentRuntime(bus);

await runComponentMain({
  name: "agentruntime",
  onStart: () => {
    runtime.start();
    console.log("[agentruntime] connected to messagebus");
  },
  onShutdown: async () => {
    await runtime.shutdown();
    bus.close();
  },
});

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
