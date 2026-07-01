import { spawn } from "node:child_process";
import type {
  ComponentStartResult,
  ComponentStarter,
  SetupComponentConfig,
  SetupConfig,
  SetupEvent,
  SetupRunResult,
} from "./types.js";

export async function runSetupSupervisor(
  config: SetupConfig,
  starter: ComponentStarter = startComponent,
): Promise<SetupRunResult> {
  const events: SetupEvent[] = [];
  const started: SetupRunResult["started"] = [];
  const processes: SetupRunResult["processes"] = [];

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
      processes.push(result);
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
          processes,
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
    processes,
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
    stdio: "ignore",
  });

  return await new Promise<ComponentStartResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`${component.name} startup timed out`));
    }, config.startupTimeoutMs);

    child.once("spawn", () => {
      cleanup();
      resolve({ pid: child.pid });
    });

    child.once("error", (error) => {
      cleanup();
      reject(error);
    });

    function cleanup(): void {
      clearTimeout(timeout);
      child.removeAllListeners("spawn");
      child.removeAllListeners("error");
    }
  });
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
