import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";

import { createElectronShell } from "../electron/index.js";
import { createRemoteMessageBus } from "../messagebus/index.js";
import type { CommandSubmittedPayload } from "../shared/types/events.js";

const port = 47_000 + Math.floor(Math.random() * 1_000);
const children: ChildProcess[] = [];

try {
  const runtime = spawnComponent("agentruntime", ["dist/agentruntime/main.js"], {
    CARVIS_MESSAGEBUS_PORT: String(port),
  });
  children.push(runtime);
  await sleep(900);

  const messagebus = spawnComponent("messagebus", ["dist/messagebus/main.js"], {
    CARVIS_MESSAGEBUS_PORT: String(port),
  });
  children.push(messagebus);
  await waitForPort(port);
  await sleep(800);

  const bus = createRemoteMessageBus({ port });
  const shell = createElectronShell(bus);

  try {
    const commandResult = await bus.publish<CommandSubmittedPayload>({
      type: "command.submitted",
      source: "electron",
      target: "agentruntime",
      requestId: "req-ipc-reconnect-smoke-1",
      payload: {
        commandText: "build reconnect smoke output",
      },
    });

    assert(commandResult.delivered >= 1, "command should be delivered after runtime reconnects");

    await waitFor(
      () => shell.getState().outputs.length === 1,
      "output.ready should arrive after reconnect",
    );
    assert(shell.getState().outputs[0]?.outputPath === "output/final-report.md", "output path should render");
  } finally {
    shell.dispose();
    bus.close();
  }

  console.log("[ipc:reconnect-smoke] ok");
} finally {
  for (const child of children) {
    await stopChild(child);
  }
}

function spawnComponent(name: string, args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn("node", args, {
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(`[${name}:stdout] ${chunk.toString("utf8")}`);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[${name}:stderr] ${chunk.toString("utf8")}`);
  });

  return child;
}

async function waitForPort(port: number): Promise<void> {
  await waitFor(
    () =>
      new Promise<boolean>((resolve) => {
        const socket = createConnection({ host: "127.0.0.1", port });

        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("error", () => {
          socket.destroy();
          resolve(false);
        });
      }),
    `port ${port} should open`,
  );
}

async function waitFor(check: () => boolean | Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }

    await sleep(100);
  }

  throw new Error(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }

    child.once("exit", () => {
      resolve();
    });
    child.kill("SIGTERM");
  });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
