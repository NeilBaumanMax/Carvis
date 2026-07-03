import type { SetupComponentConfig, SetupConfig, SetupMode } from "./types.js";

export function loadSetupConfig(env: NodeJS.ProcessEnv): SetupConfig {
  return {
    mode: readMode(env.CARVIS_SETUP_MODE),
    startupTimeoutMs: readPositiveInt(env.CARVIS_SETUP_TIMEOUT_MS, 15_000),
    components: createDefaultComponents(env),
  };
}

function createDefaultComponents(env: NodeJS.ProcessEnv): readonly SetupComponentConfig[] {
  const components: SetupComponentConfig[] = [
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

  if (env.CARVIS_NAS_ENABLED !== "0") {
    components.push({
      name: "nas",
      command: env.CARVIS_NAS_BIN ?? "nas/carvis-nas-server",
      args: [],
      required: true,
      environment: readNasEnvironment(env),
    });
  }

  return components;
}

function readAgentRuntimeEnvironment(env: NodeJS.ProcessEnv): Readonly<Record<string, string>> | undefined {
  const values: Record<string, string> = {
    PATH: env.CARVIS_AGENTRUNTIME_PATH ?? defaultNixSystemPath(env.PATH),
  };

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
    "CARVIS_LAN_IP",
    "CARVIS_NAS_PUBLIC_URL",
    "CARVIS_NGINX_URL",
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

function readNasEnvironment(env: NodeJS.ProcessEnv): Readonly<Record<string, string>> | undefined {
  const values: Record<string, string> = {};

  for (const key of [
    "CARVIS_NAS_CONFIG_DIR",
    "CARVIS_NAS_CLIENT_DIR",
    "CARVIS_NAS_HOST",
    "CARVIS_NAS_PORT",
    "CARVIS_NAS_PUBLIC_URL",
    "CARVIS_NGINX_URL",
    "CARVIS_LAN_IP",
    "CARVIS_ELECTRON_API_URL",
    "CARVIS_OUTPUT_ROOT",
    "CARVIS_HISTORY_ROOT",
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

function defaultNixSystemPath(path: string | undefined): string {
  const entries = [
    ...(path ?? "").split(":").filter((entry) => entry.length > 0),
    "/run/current-system/sw/bin",
    "/run/wrappers/bin",
  ];

  return [...new Set(entries)].join(":");
}
