import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadSetupConfig } from "./config.js";
import {
  createSystemdUserUnits,
  installSystemdUserUnits,
  uninstallSystemdUserUnits,
} from "./systemd.js";

type InstallMode = "dry-run" | "install" | "uninstall" | "status";

const env = process.env;
const mode = readMode(env.CARVIS_SYSTEMD_INSTALL_MODE);
const unitDir = await readUnitDir(mode, env.CARVIS_SYSTEMD_UNIT_DIR);
const workingDirectory = env.CARVIS_SYSTEMD_WORKDIR ?? process.cwd();
const nodePath = env.CARVIS_SYSTEMD_NODE ?? process.execPath;
const messagebusPort = readPort(env.CARVIS_MESSAGEBUS_PORT);
const config = loadSetupConfig(env);

if (mode === "uninstall") {
  const removed = await uninstallSystemdUserUnits(unitDir);

  console.log(`[setup:systemd-install] uninstalled ${removed.length} units from ${unitDir}`);
  process.exit(0);
}

if (mode === "status") {
  const statuses = await readUnitStatuses(unitDir);
  const missing = statuses.filter((status) => !status.installed);

  for (const status of statuses) {
    console.log(
      `[setup:systemd-install] ${status.installed ? "installed" : "missing"} ${join(unitDir, status.filename)}`,
    );
  }

  process.exit(missing.length === 0 ? 0 : 1);
}

if (mode === "dry-run") {
  const units = createSystemdUserUnits(config.components, {
    workingDirectory,
    nodePath,
    messagebusPort,
  });

  await installSystemdUserUnits(config.components, {
    unitDir,
    workingDirectory,
    nodePath,
    messagebusPort,
  });

  for (const unit of units) {
    console.log(`[setup:systemd-install] dry-run wrote ${join(unitDir, unit.filename)}`);
  }
  console.log("[setup:systemd-install] dry-run complete");
  process.exit(0);
}

const units = await installSystemdUserUnits(config.components, {
  unitDir,
  workingDirectory,
  nodePath,
  messagebusPort,
});

for (const unit of units) {
  console.log(`[setup:systemd-install] wrote ${join(unitDir, unit.filename)}`);
}
console.log("[setup:systemd-install] run: systemctl --user daemon-reload && systemctl --user enable --now carvis.target");

function readMode(value: string | undefined): InstallMode {
  if (value === "install" || value === "uninstall" || value === "status") {
    return value;
  }

  return "dry-run";
}

async function readUnitDir(mode: InstallMode, value: string | undefined): Promise<string> {
  if (value !== undefined && value.length > 0) {
    return value;
  }

  if (mode === "install" || mode === "uninstall" || mode === "status") {
    const home = env.HOME;

    if (home === undefined || home.length === 0) {
      throw new Error("HOME is required when CARVIS_SYSTEMD_UNIT_DIR is not set");
    }

    return join(home, ".config", "systemd", "user");
  }

  return mkdtemp(join(tmpdir(), "carvis-systemd-cli-"));
}

async function readUnitStatuses(unitDir: string): Promise<Array<{ filename: string; installed: boolean }>> {
  const filenames = [
    "carvis-messagebus.service",
    "carvis-agentruntime.service",
    "carvis-electron.service",
    "carvis.target",
  ];

  return Promise.all(
    filenames.map(async (filename) => {
      try {
        await access(join(unitDir, filename));
        return {
          filename,
          installed: true,
        };
      } catch {
        return {
          filename,
          installed: false,
        };
      }
    }),
  );
}

function readPort(value: string | undefined): number {
  if (value === undefined) {
    return 45931;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isFinite(port) || port <= 0) {
    return 45931;
  }

  return port;
}
