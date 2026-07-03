import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: configDir,
  base: "./",
  publicDir: "public",
  plugins: [react()],
  build: {
    outDir: resolve(configDir, "../../../dist/electron/carvisui"),
    emptyOutDir: true,
  },
});
