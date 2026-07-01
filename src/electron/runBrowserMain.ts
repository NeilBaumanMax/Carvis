import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const appDir = await mkdtemp(join(tmpdir(), "carvis-electron-app-"));
const browserEntry = resolve("dist/electron/browserMain.js");

await writeFile(
  join(appDir, "package.json"),
  `${JSON.stringify(
    {
      name: "carvis-electron-browser",
      version: "0.0.0",
      type: "module",
      main: "main.mjs",
    },
    null,
    2,
  )}\n`,
  "utf8",
);
await writeFile(join(appDir, "main.mjs"), `import ${JSON.stringify(`file://${browserEntry}`)};\n`, "utf8");
const env = await createElectronEnvironment();

await new Promise<void>((resolvePromise, reject) => {
  const child = spawn(process.env.CARVIS_ELECTRON_BIN ?? "electron", ["--no-sandbox", appDir], {
    env,
    stdio: "inherit",
  });

  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (code === 0) {
      resolvePromise();
      return;
    }

    reject(new Error(`electron browser exited code=${String(code)} signal=${String(signal)}`));
  });
});

async function createElectronEnvironment(): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DISPLAY: process.env.DISPLAY ?? ":0",
  };

  if (env.XAUTHORITY === undefined || env.XAUTHORITY.length === 0) {
    const auth = await findXauthority();

    if (auth !== undefined) {
      env.XAUTHORITY = auth;
    }
  }

  return env;
}

async function findXauthority(): Promise<string | undefined> {
  const runtimeDir = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;

  try {
    const entries = await readdir(runtimeDir);
    const match = entries.find((entry) => entry.startsWith("xauth_"));

    if (match !== undefined) {
      return join(runtimeDir, match);
    }
  } catch {
    // Fall through to the conventional path.
  }

  return process.env.HOME === undefined ? undefined : join(process.env.HOME, ".Xauthority");
}
