export { loadSetupConfig } from "./config.js";
export { runSetupSupervisor, startComponent } from "./supervisor.js";
export { readKeysFile, applyKeysToEnv } from "./keys.js";
export type { KeyStore } from "./keys.js";
export type {
  ComponentStarter,
  ComponentStartResult,
  SetupComponentConfig,
  SetupComponentName,
  SetupConfig,
  SetupEvent,
  SetupMode,
  SetupRunResult,
} from "./types.js";
