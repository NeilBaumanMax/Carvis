import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { loadSetupConfig } from "./config.js";
import { installSystemdUserUnits } from "./systemd.js";

const execFileAsync = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "carvis-systemd-install-"));
const unitDir = join(root, "user");
const cliUnitDir = join(root, "cli-user");
const config = loadSetupConfig({});

try {
  const units = await installSystemdUserUnits(config.components, {
    unitDir,
    workingDirectory: "/home/howtion/carvis",
    nodePath: "/run/current-system/sw/bin/node",
    messagebusPort: 45931,
  });
  const filenames = await readdir(unitDir);

  assertSequence(
    filenames.sort(),
    [
      "carvis-agentruntime.service",
      "carvis-electron.service",
      "carvis-messagebus.service",
      "carvis.target",
    ],
  );
  assert(units.length === 4, "installer should return four unit files");

  const target = await readFile(join(unitDir, "carvis.target"), "utf8");
  const runtime = await readFile(join(unitDir, "carvis-agentruntime.service"), "utf8");

  assert(target.includes("WantedBy=default.target"), "target install section should be present");
  assert(runtime.includes("After=carvis-messagebus.service"), "runtime unit should preserve dependency");
  assert(runtime.includes("WorkingDirectory=/home/howtion/carvis"), "runtime unit should preserve cwd");

  const cliResult = await execFileAsync(process.execPath, ["dist/setup/systemdInstall.js"], {
    env: {
      ...process.env,
      CARVIS_SYSTEMD_UNIT_DIR: cliUnitDir,
      CARVIS_SYSTEMD_WORKDIR: "/home/howtion/carvis",
      CARVIS_SYSTEMD_NODE: "/run/current-system/sw/bin/node",
      CARVIS_MESSAGEBUS_PORT: "45931",
    },
  });
  const cliFiles = await readdir(cliUnitDir);

  assert(cliResult.stdout.includes("dry-run complete"), "CLI dry-run should report completion");
  assert(cliFiles.includes("carvis.target"), "CLI dry-run should write target");

  const statusResult = await execFileAsync(process.execPath, ["dist/setup/systemdInstall.js"], {
    env: {
      ...process.env,
      CARVIS_SYSTEMD_INSTALL_MODE: "status",
      CARVIS_SYSTEMD_UNIT_DIR: cliUnitDir,
    },
  });

  assert(statusResult.stdout.includes("installed"), "CLI status should report installed units");

  const uninstallResult = await execFileAsync(process.execPath, ["dist/setup/systemdInstall.js"], {
    env: {
      ...process.env,
      CARVIS_SYSTEMD_INSTALL_MODE: "uninstall",
      CARVIS_SYSTEMD_UNIT_DIR: cliUnitDir,
    },
  });
  const remainingCliFiles = await readdir(cliUnitDir);

  assert(uninstallResult.stdout.includes("uninstalled 4 units"), "CLI uninstall should report removed units");
  assert(remainingCliFiles.length === 0, "CLI uninstall should remove all carvis units");

  try {
    await execFileAsync(process.execPath, ["dist/setup/systemdInstall.js"], {
      env: {
        ...process.env,
        CARVIS_SYSTEMD_INSTALL_MODE: "status",
        CARVIS_SYSTEMD_UNIT_DIR: cliUnitDir,
      },
    });
    throw new Error("CLI status should fail after uninstall");
  } catch (error) {
    assert(
      isExecError(error) && error.stdout.includes("missing"),
      "CLI status after uninstall should report missing units",
    );
  }

  console.log("[setup:systemd-install-smoke] ok");
} finally {
  await rm(root, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isExecError(error: unknown): error is { stdout: string } {
  return typeof error === "object" && error !== null && "stdout" in error;
}

function assertSequence<T>(actual: readonly T[], expected: readonly T[]): void {
  assert(actual.length === expected.length, `expected ${expected.length} values, got ${actual.length}`);

  for (const [index, expectedValue] of expected.entries()) {
    assert(
      actual[index] === expectedValue,
      `expected value ${index} to be ${String(expectedValue)}, got ${String(actual[index])}`,
    );
  }
}
