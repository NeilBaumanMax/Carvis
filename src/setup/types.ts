import type { ChildProcess } from "node:child_process";

export type SetupComponentName = "messagebus" | "agentruntime" | "electron";

export type SetupMode = "plan" | "spawn";

export interface SetupComponentConfig {
  name: SetupComponentName;
  command: string;
  args: readonly string[];
  required: boolean;
}

export interface SetupConfig {
  mode: SetupMode;
  startupTimeoutMs: number;
  components: readonly SetupComponentConfig[];
}

export type SetupEventType =
  | "setup.started"
  | "component.starting"
  | "component.started"
  | "component.failed"
  | "setup.finished"
  | "setup.failed";

export interface SetupEvent {
  type: SetupEventType;
  timestamp: string;
  component?: SetupComponentName;
  message: string;
}

export interface ComponentStartResult {
  pid?: number;
  childProcess?: ChildProcess;
}

export type ComponentStarter = (
  component: SetupComponentConfig,
  config: SetupConfig,
) => Promise<ComponentStartResult>;

export interface SetupRunResult {
  ok: boolean;
  events: SetupEvent[];
  started: SetupComponentName[];
  startedProcesses: StartedComponentProcess[];
  failed?: SetupComponentName;
}

export interface StartedComponentProcess {
  name: SetupComponentName;
  pid: number;
  childProcess: ChildProcess;
}
