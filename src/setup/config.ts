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
      environment: readAgentRuntimeEnvironment(env),
      environmentFile: env.CARVIS_AGENTRUNTIME_ENV_FILE,
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

function readAgentRuntimeEnvironment(env: NodeJS.ProcessEnv): Readonly<Record<string, string>> | undefined {
  const values: Record<string, string> = {};

  for (const key of [
    "CARVIS_AGENTRUNTIME_REAL_PROVIDERS",
    "CARVIS_PROVIDER_MODE",
    "CARVIS_REAL_PROVIDER_TIMEOUT_MS",
    "CARVIS_REAL_PROVIDER_MAX_ATTEMPTS",
    "CARVIS_REAL_PROVIDER_MAX_BUDGET_USD",
    "CARVIS_ENGINEER_RUNS_AFTER_FAILED_REVIEW",
    "CARVIS_CLAUDE_CODE_BIN",
    "CARVIS_CLAUDE_CODE_RUNNER",
    "CARVIS_CLAUDE_CODE_BARE",
    "QWEN_OPENAI_BASE_URL",
    "QWEN_OMNI_MODEL",
  ]) {
    const value = env[key];

    if (value !== undefined && value.length > 0) {
      values[key] = value;
    }
  }

  return Object.keys(values).length === 0 ? undefined : values;
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
