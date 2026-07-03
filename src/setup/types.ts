export type SetupComponentName = "messagebus" | "agentruntime" | "electron" | "nas";

export type SetupMode = "plan" | "spawn";

export interface SetupComponentConfig {
  name: SetupComponentName;
  command: string;
  args: readonly string[];
  required: boolean;
  environment?: Readonly<Record<string, string>>;
  environmentFile?: string;
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
}

export type ComponentStarter = (
  component: SetupComponentConfig,
  config: SetupConfig,
) => Promise<ComponentStartResult>;

export interface SetupRunResult {
  ok: boolean;
  events: SetupEvent[];
  started: SetupComponentName[];
  processes: ComponentStartResult[];
  failed?: SetupComponentName;
}

export interface SystemdUnitFile {
  filename: string;
  content: string;
}

export interface SystemdUnitOptions {
  workingDirectory: string;
  nodePath?: string;
  messagebusPort?: number;
}
