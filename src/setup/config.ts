import type { SetupComponentConfig, SetupConfig, SetupMode } from "./types.js";

const defaultComponents: readonly SetupComponentConfig[] = [
  {
    name: "messagebus",
    command: "node",
    args: ["dist/messagebus/main.js"],
    required: true,
  },
  {
    name: "agentruntime",
    command: "node",
    args: ["dist/agentruntime/main.js"],
    required: true,
  },
  {
    name: "electron",
    command: "node",
    args: ["dist/electron/main.js"],
    required: true,
  },
];

export function loadSetupConfig(env: NodeJS.ProcessEnv): SetupConfig {
  return {
    mode: readMode(env.CARVIS_SETUP_MODE),
    startupTimeoutMs: readPositiveInt(env.CARVIS_SETUP_TIMEOUT_MS, 15_000),
    components: defaultComponents,
  };
}

function readMode(value: string | undefined): SetupMode {
  if (value === "spawn") {
    return "spawn";
  }

  return "plan";
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
