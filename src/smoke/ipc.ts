import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";

import { createElectronShell } from "../electron/index.js";
import { createRemoteMessageBus } from "../messagebus/index.js";
import type { CommandSubmittedPayload } from "../shared/types/events.js";

const port = 46_000 + Math.floor(Math.random() * 1_000);
const children: ChildProcess[] = [];

try {
  const messagebus = spawnComponent("messagebus", ["dist/messagebus/main.js"], {
    CARVIS_MESSAGEBUS_PORT: String(port),
  });
  children.push(messagebus);
  await waitForPort(port);

  const runtime = spawnComponent("agentruntime", ["dist/agentruntime/main.js"], {
    CARVIS_MESSAGEBUS_PORT: String(port),
    CARVIS_AGENTRUNTIME_STREAM_DELAY_MS: "1",
    CARVIS_AGENTRUNTIME_PREVIEW_DELAY_MS: "1",
  });
  children.push(runtime);
  await sleep(1_000);

  const bus = createRemoteMessageBus({ port });
  const shell = createElectronShell(bus);
  const electronEvents: string[] = [];
  bus.subscribe(
    {
      target: "electron",
    },
    (event) => {
      electronEvents.push(event.type);
    },
  );
  await sleep(500);

  try {
    const commandResult = await bus.publish<CommandSubmittedPayload>({
      type: "command.submitted",
      source: "electron",
      target: "agentruntime",
      requestId: "req-ipc-smoke-1",
      payload: {
        commandText: "build ipc smoke output",
      },
    });
    assert(commandResult.delivered >= 1, "command should be delivered to agentruntime over IPC");

    await waitFor(
      () => shell.getState().outputs.length === 1,
      () => `output.ready should arrive over IPC; received=${electronEvents.join(",")}`,
    );

    const state = shell.getState();

    assert(state.outputs[0]?.outputPath === "output/final-report.md", "output path should be visible");
    assert(state.runtime.queueDepth === 0, "runtime queue should drain");

    for (const role of ["manager", "writer", "artist", "researcher", "engineer"] as const) {
      const panel = state.panels.find((item) => item.role === role);

      assert(panel !== undefined, `${role} panel should exist`);
      assert(panel.status === "shutdown", `${role} panel should be shutdown`);
      assert(panel.pid !== undefined, `${role} panel should include pid`);
    }
  } finally {
    shell.dispose();
    bus.close();
  }

  console.log("[ipc:smoke] ok");
} finally {
  for (const child of [...children].reverse()) {
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
  child.once("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      process.stderr.write(`[${name}] exited with code ${code}\n`);
    }

    if (signal !== null && signal !== "SIGTERM") {
      process.stderr.write(`[${name}] exited with signal ${signal}\n`);
    }
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

async function waitFor(
  check: () => boolean | Promise<boolean>,
  message: string | (() => string),
): Promise<void> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }

    await sleep(100);
  }

  throw new Error(typeof message === "function" ? message() : message);
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
