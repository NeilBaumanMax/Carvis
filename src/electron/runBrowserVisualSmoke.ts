import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const appDir = await mkdtemp(join(tmpdir(), "carvis-electron-app-"));
const smokeEntry = resolve("dist/electron/browserVisualSmoke.js");

await writeFile(
  join(appDir, "package.json"),
  `${JSON.stringify(
    {
      name: "carvis-electron-visual-smoke",
      version: "0.0.0",
      type: "module",
      main: "main.mjs",
    },
    null,
    2,
  )}\n`,
  "utf8",
);
await writeFile(
  join(appDir, "main.mjs"),
  `import ${JSON.stringify(`file://${smokeEntry}`)};\n`,
  "utf8",
);

await new Promise<void>((resolvePromise, reject) => {
  const child = spawn(process.env.CARVIS_ELECTRON_BIN ?? "electron", ["--no-sandbox", appDir], {
    env: process.env,
    stdio: "inherit",
  });

  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (code === 0) {
      resolvePromise();
      return;
    }

    reject(new Error(`electron visual smoke exited code=${String(code)} signal=${String(signal)}`));
  });
});
