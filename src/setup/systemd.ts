import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import type {
  SetupComponentConfig,
  SetupComponentName,
  SystemdUnitFile,
  SystemdUnitOptions,
} from "./types.js";

const componentDescriptions: Record<SetupComponentName, string> = {
  messagebus: "Carvis Message Bus",
  agentruntime: "Carvis Agent Runtime",
  electron: "Carvis Electron Shell",
  nas: "Carvis NAS Remote Control",
};

export function createSystemdUserUnits(
  components: readonly SetupComponentConfig[],
  options: SystemdUnitOptions,
): SystemdUnitFile[] {
  const port = options.messagebusPort ?? 45931;
  const nodePath = options.nodePath ?? "node";
  const units = components.map((component) =>
    createComponentUnit(component, {
      ...options,
      nodePath,
      messagebusPort: port,
    }),
  );

  return [
    ...units,
    {
      filename: "carvis.target",
      content: [
        "[Unit]",
        "Description=Carvis MVP",
        `Requires=${unitList(components)}`,
        `After=${unitList(components)}`,
        "",
        "[Install]",
        "WantedBy=default.target",
        "",
      ].join("\n"),
    },
  ];
}

export interface InstallSystemdUserUnitsOptions extends SystemdUnitOptions {
  unitDir: string;
}

export async function installSystemdUserUnits(
  components: readonly SetupComponentConfig[],
  options: InstallSystemdUserUnitsOptions,
): Promise<SystemdUnitFile[]> {
  const units = createSystemdUserUnits(components, options);

  await mkdir(options.unitDir, { recursive: true });

  for (const unit of units) {
    await writeFile(join(options.unitDir, unit.filename), unit.content, "utf8");
  }

  return units;
}

export async function uninstallSystemdUserUnits(unitDir: string): Promise<string[]> {
  const filenames = [
    "carvis-messagebus.service",
    "carvis-agentruntime.service",
    "carvis-electron.service",
    "carvis-nas.service",
    "carvis.target",
  ];

  for (const filename of filenames) {
    await rm(join(unitDir, filename), { force: true });
  }

  return filenames;
}

function createComponentUnit(
  component: SetupComponentConfig,
  options: Required<SystemdUnitOptions>,
): SystemdUnitFile {
  const executable = resolveExecutable(component.command, options);

  return {
    filename: `carvis-${component.name}.service`,
    content: [
      "[Unit]",
      `Description=${componentDescriptions[component.name]}`,
      ...dependencyLines(component.name),
      "",
      "[Service]",
      "Type=simple",
      `WorkingDirectory=${escapeSystemdValue(options.workingDirectory)}`,
      `ExecStart=${escapeSystemdExec([executable, ...component.args])}`,
      `Environment=CARVIS_MESSAGEBUS_PORT=${options.messagebusPort}`,
      ...environmentFileLines(component.environmentFile),
      ...environmentLines(component.environment),
      "Restart=on-failure",
      "RestartSec=3",
      "",
      "[Install]",
      "WantedBy=carvis.target",
      "",
    ].join("\n"),
  };
}

function dependencyLines(component: SetupComponentName): string[] {
  if (component === "messagebus") {
    return [];
  }

  if (component === "agentruntime") {
    return ["Requires=carvis-messagebus.service", "After=carvis-messagebus.service"];
  }

  if (component === "electron") {
    return [
      "Requires=carvis-messagebus.service carvis-agentruntime.service",
      "After=carvis-messagebus.service carvis-agentruntime.service",
    ];
  }

  return [
    "Requires=carvis-messagebus.service carvis-agentruntime.service carvis-electron.service",
    "After=carvis-messagebus.service carvis-agentruntime.service carvis-electron.service",
  ];
}

function unitList(components: readonly SetupComponentConfig[]): string {
  return components.map((component) => `carvis-${component.name}.service`).join(" ");
}

function resolveExecutable(command: string, options: Required<SystemdUnitOptions>): string {
  if (command === "node") {
    return options.nodePath;
  }

  if (command.includes("/") && !isAbsolute(command)) {
    return resolve(options.workingDirectory, command);
  }

  return command;
}

function environmentFileLines(environmentFile: string | undefined): string[] {
  if (environmentFile === undefined || environmentFile.length === 0) {
    return [];
  }

  return [`EnvironmentFile=${escapeSystemdValue(environmentFile)}`];
}

function environmentLines(environment: Readonly<Record<string, string>> | undefined): string[] {
  if (environment === undefined) {
    return [];
  }

  return Object.entries(environment).map(
    ([key, value]) => `Environment=${key}=${escapeSystemdValue(value)}`,
  );
}

function escapeSystemdExec(parts: readonly string[]): string {
  return parts.map(escapeSystemdValue).join(" ");
}

function escapeSystemdValue(value: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
