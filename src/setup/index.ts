export { loadSetupConfig } from "./config.js";
export { runSetupSupervisor, shutdownStartedProcesses, startComponent } from "./supervisor.js";
export type {
  ComponentStarter,
  ComponentStartResult,
  SetupComponentConfig,
  SetupComponentName,
  SetupConfig,
  SetupEvent,
  SetupMode,
  SetupRunResult,
  StartedComponentProcess,
} from "./types.js";
