import type { SetupComponentConfig, SetupConfig, SetupMode } from "./types.js";

export function loadSetupConfig(env: NodeJS.ProcessEnv): SetupConfig {
  return {
    mode: readMode(env.CARVIS_SETUP_MODE),
    startupTimeoutMs: readPositiveInt(env.CARVIS_SETUP_TIMEOUT_MS, 15_000),
    components: createDefaultComponents(env),
  };
}

function createDefaultComponents(env: NodeJS.ProcessEnv): readonly SetupComponentConfig[] {
  return [
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
      args: [env.CARVIS_ELECTRON_BROWSER === "1" ? "dist/electron/runBrowserMain.js" : "dist/electron/main.js"],
      required: true,
      environment: readElectronEnvironment(env),
    },
  ];
}

function readElectronEnvironment(env: NodeJS.ProcessEnv): Readonly<Record<string, string>> | undefined {
  const values: Record<string, string> = {};

  for (const key of [
    "CARVIS_ELECTRON_BIN",
    "CARVIS_ELECTRON_RENDERER_DIR",
    "CARVIS_ELECTRON_FULLSCREEN",
    "CARVIS_ELECTRON_START_DELAY_MS",
    "DISPLAY",
    "XAUTHORITY",
  ]) {
    const value = env[key];

    if (value !== undefined && value.length > 0) {
      values[key] = value;
    }
  }

  return Object.keys(values).length === 0 ? undefined : values;
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
