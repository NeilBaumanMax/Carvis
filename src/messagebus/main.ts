import { runComponentMain } from "../shared/componentMain.js";
import { startTcpMessageBusServer } from "./index.js";

const port = readPort(process.env.CARVIS_MESSAGEBUS_PORT);
const server = await startTcpMessageBusServer(port);

await runComponentMain({
  name: "messagebus",
  onStart: () => {
    console.log(`[messagebus] tcp server listening on 127.0.0.1:${server.port}`);
  },
  onShutdown: async () => {
    await server.close();
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
