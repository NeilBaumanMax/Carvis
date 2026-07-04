import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type {
  ComponentStartResult,
  ComponentStarter,
  SetupComponentConfig,
  SetupConfig,
  SetupEvent,
  SetupRunResult,
  StartedComponentProcess,
} from "./types.js";

export async function runSetupSupervisor(
  config: SetupConfig,
  starter: ComponentStarter = startComponent,
): Promise<SetupRunResult> {
  const events: SetupEvent[] = [];
  const started: SetupRunResult["started"] = [];
  const startedProcesses: StartedComponentProcess[] = [];

  record(events, {
    type: "setup.started",
    message: `setup starting in ${config.mode} mode`,
  });

  for (const component of config.components) {
    record(events, {
      type: "component.starting",
      component: component.name,
      message: `starting ${component.name}`,
    });

    try {
      const result = await starter(component, config);
      started.push(component.name);

      if (result.childProcess !== undefined && result.pid !== undefined) {
        startedProcesses.push({
          name: component.name,
          pid: result.pid,
          childProcess: result.childProcess,
        });
      }

      record(events, {
        type: "component.started",
        component: component.name,
        message: formatStartedMessage(component, result),
      });
    } catch (error) {
      record(events, {
        type: "component.failed",
        component: component.name,
        message: formatError(error),
      });

      if (component.required) {
        record(events, {
          type: "setup.failed",
          component: component.name,
          message: `required component ${component.name} failed`,
        });

        return {
          ok: false,
          events,
          started,
          startedProcesses,
          failed: component.name,
        };
      }
    }
  }

  record(events, {
    type: "setup.finished",
    message: "setup finished",
  });

  return {
    ok: true,
    events,
    started,
    startedProcesses,
  };
}

export async function startComponent(
  component: SetupComponentConfig,
  config: SetupConfig,
): Promise<ComponentStartResult> {
  if (config.mode === "plan") {
    return {};
  }

  const child = spawn(component.command, [...component.args], {
    detached: false,
    stdio: "inherit",
  });

  return await new Promise<ComponentStartResult>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`${component.name} startup timed out`));
    }, config.startupTimeoutMs);

    child.once("spawn", () => {
      setTimeout(() => {
        settled = true;
        cleanup();
        resolve({
          pid: child.pid,
          childProcess: child,
        });
      }, 250);
    });

    child.once("error", (error) => {
      settled = true;
      cleanup();
      reject(error);
    });

    child.once("exit", (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error(`${component.name} exited during startup with code ${String(code)} signal ${String(signal)}`));
    });

    function cleanup(): void {
      clearTimeout(timeout);
      child.removeAllListeners("spawn");
      child.removeAllListeners("error");
      child.removeAllListeners("exit");
    }
  });
}

export async function shutdownStartedProcesses(
  result: Pick<SetupRunResult, "startedProcesses">,
  signal: NodeJS.Signals = "SIGTERM",
): Promise<void> {
  for (const startedProcess of [...result.startedProcesses].reverse()) {
    const child = startedProcess.childProcess;

    if (child.exitCode !== null || child.killed) {
      continue;
    }

    child.kill(signal);
    await waitForChildExit(child, 2_000);
  }
}

async function waitForChildExit(
  child: StartedComponentProcess["childProcess"],
  timeoutMs: number,
): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  await Promise.race([
    new Promise<void>((resolve) => {
      child.once("exit", () => {
        resolve();
      });
    }),
    delay(timeoutMs).then(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
    }),
  ]);
}

function record(
  events: SetupEvent[],
  event: Omit<SetupEvent, "timestamp">,
): void {
  events.push({
    ...event,
    timestamp: new Date().toISOString(),
  });
}

function formatStartedMessage(
  component: SetupComponentConfig,
  result: ComponentStartResult,
): string {
  if (result.pid === undefined) {
    return `${component.name} start planned`;
  }

  return `${component.name} started with pid ${result.pid}`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
