import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ElectronOutputEntry, ElectronShellState, ElectronWorkplacePanel } from "./types.js";

export interface ElectronRendererSnapshot {
  htmlPath: string;
}

export interface ElectronRendererPreload {
  preloadPath: string;
}

export async function writeElectronRendererSnapshot(
  outputDir: string,
  state: ElectronShellState,
): Promise<ElectronRendererSnapshot> {
  await mkdir(outputDir, { recursive: true });
  const htmlPath = join(outputDir, "electron-shell.html");

  await writeFile(htmlPath, renderElectronHtml(state), "utf8");

  return {
    htmlPath,
  };
}

export async function writeElectronRendererPreload(outputDir: string): Promise<ElectronRendererPreload> {
  await mkdir(outputDir, { recursive: true });
  const preloadPath = join(outputDir, "electron-preload.cjs");

  await writeFile(
    preloadPath,
    `"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("carvis", {
  getState: () => ipcRenderer.invoke("carvis:get-state"),
  submitCommand: (commandText) => ipcRenderer.invoke("carvis:submit-command", commandText),
  openOutput: (outputPath) => ipcRenderer.invoke("carvis:open-output", outputPath),
  onState: (listener) => {
    const wrapped = (_event, state) => listener(state);
    ipcRenderer.on("carvis:state", wrapped);
    return () => ipcRenderer.off("carvis:state", wrapped);
  },
});
`,
    "utf8",
  );

  return {
    preloadPath,
  };
}

export function renderElectronHtml(state: ElectronShellState): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Carvis</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f6f8;
      --panel: #ffffff;
      --ink: #18202a;
      --muted: #667085;
      --line: #d7dde5;
      --blue: #2563eb;
      --green: #12805c;
      --amber: #a15c07;
      --red: #b42318;
      --violet: #6741d9;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-width: 320px;
      min-height: 100vh;
      background: var(--bg);
      color: var(--ink);
    }

    .app {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
    }

    .topbar,
    .commandbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--line);
      background: #ffffff;
    }

    .commandbar {
      border-top: 1px solid var(--line);
      border-bottom: 0;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      font-weight: 700;
      font-size: 16px;
    }

    .mark {
      width: 26px;
      height: 26px;
      border-radius: 7px;
      background: linear-gradient(135deg, var(--blue), var(--green));
    }

    .stats {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .stat,
    .event,
    .output-link {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f9fafb;
      padding: 5px 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.2;
      white-space: nowrap;
      cursor: pointer;
      font: inherit;
      text-align: left;
    }

    .output-preview {
      display: grid;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px;
      background: #f9fafb;
      min-width: 0;
    }

    .output-preview-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }

    .output-folder {
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.3;
    }

    .output-files {
      display: grid;
      gap: 3px;
      color: #344054;
      font-size: 11px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .output-report {
      min-height: 90px;
      max-height: 150px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border: 1px solid #c9d2df;
      border-radius: 6px;
      padding: 7px;
      background: #ffffff;
      color: #18202a;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 10px;
      line-height: 1.35;
    }

    .workspace {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 6px;
      padding: 8px;
      align-items: stretch;
    }

    .panel {
      min-width: 0;
      min-height: 188px;
      display: grid;
      grid-template-rows: auto auto minmax(102px, 1fr);
      gap: 5px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 7px;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-width: 0;
    }

    .role {
      overflow-wrap: anywhere;
      font-size: 13px;
      font-weight: 700;
    }

    .status {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 4px 7px;
      color: #ffffff;
      font-size: 10px;
      line-height: 1;
      background: var(--muted);
    }

    .status-working,
    .status-ready,
    .status-starting {
      background: var(--blue);
    }

    .status-retained,
    .status-done {
      background: var(--green);
    }

    .status-shutdown {
      background: var(--ink);
    }

    .status-idle {
      background: var(--muted);
    }

    .meta {
      display: grid;
      gap: 3px;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.18;
      min-width: 0;
    }

    .meta div,
    .output-link,
    .event {
      overflow-wrap: anywhere;
    }

    .latest {
      min-height: 102px;
      max-height: 132px;
      border: 2px solid #27c46a;
      border-radius: 8px;
      padding: 23px 7px 7px;
      background: #07110c;
      color: #8cffb4;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 10px;
      line-height: 1.3;
      overflow-wrap: anywhere;
      overflow: auto;
      white-space: pre-wrap;
      box-shadow: inset 0 0 0 1px rgba(140, 255, 180, 0.14), 0 0 0 1px rgba(39, 196, 106, 0.14);
      position: relative;
    }

    .latest::before {
      content: "LIVE CLI OUTPUT";
      position: absolute;
      top: 7px;
      left: 8px;
      color: #ffffff;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0;
    }

    .latest::after {
      content: "";
      position: absolute;
      top: 9px;
      right: 9px;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #27c46a;
      box-shadow: 0 0 10px rgba(39, 196, 106, 0.85);
    }

    .side {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
      gap: 6px;
      padding: 0 8px 7px;
    }

    .rail {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
      padding: 7px;
      min-width: 0;
    }

    .rail h2 {
      margin: 0 0 6px;
      font-size: 13px;
    }

    .stack {
      display: grid;
      gap: 8px;
    }

    .command-form {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
    }

    .command-input {
      width: 100%;
      min-width: 0;
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 12px;
      color: var(--ink);
      font: inherit;
      font-size: 13px;
      background: #ffffff;
    }

    .command-button {
      height: 36px;
      border: 0;
      border-radius: 8px;
      padding: 0 16px;
      color: #ffffff;
      background: var(--blue);
      font-weight: 700;
      cursor: pointer;
    }

    @media (max-width: 900px) {
      .side {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 620px) {
      .topbar,
      .commandbar {
        align-items: stretch;
        flex-direction: column;
      }

      .workspace {
        grid-template-columns: 1fr;
      }

      .command-form {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div id="carvis-root">${renderElectronApp(state)}</div>
  <script>
    window.__CARVIS_INITIAL_STATE__ = ${JSON.stringify(state)};
  </script>
  <script>
    const root = document.getElementById("carvis-root");
    let currentState = window.__CARVIS_INITIAL_STATE__;

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function renderPanel(panel) {
      return \`<article class="panel" data-role="\${escapeHtml(panel.role)}">
  <div class="panel-header">
    <div class="role">\${escapeHtml(panel.title)}</div>
    <div class="status status-\${escapeHtml(panel.status)}">\${escapeHtml(panel.status)}</div>
  </div>
  <div class="meta">
    <div>pid \${panel.pid ?? "none"}</div>
    <div>\${escapeHtml(panel.workplacePath)}</div>
    <div>\${escapeHtml(panel.lastHeartbeatAt ?? "no heartbeat")}</div>
  </div>
  <div class="latest">\${escapeHtml(panel.latestOutput ?? "waiting")}</div>
</article>\`;
    }

    function renderOutputPreview(output) {
      const files = [
        output.gamePreviewPath ? \`game preview: \${output.gamePreviewPath}\` : "game preview: none",
        \`final report: \${output.outputPath}\`,
        output.manifestPath ? \`manifest: \${output.manifestPath}\` : "manifest: none",
        ...(output.manifestEntries ?? []).map((entry) => \`\${entry.role}: \${entry.sourcePath}\`),
      ];

      return \`<article class="output-preview">
  <div class="output-preview-head">
    <div class="output-folder">folder \${escapeHtml(output.outputFolderPath ?? "")}</div>
    <button class="output-link" type="button" data-output-open="\${escapeHtml(output.outputFolderPath ?? output.outputPath)}">Open</button>
  </div>
  <div class="output-files">\${files.map((file) => \`<div>\${escapeHtml(file)}</div>\`).join("")}</div>
  <div class="output-report">\${escapeHtml(output.previewText ?? output.previewStatus ?? "preview unavailable")}</div>
</article>\`;
    }

    function renderApp(state) {
      const outputHtml = state.outputs.length === 0
        ? '<span class="event">none</span>'
        : state.outputs
          .map(renderOutputPreview)
          .join("\\n");
      const eventHtml = state.recentEvents.length === 0
        ? '<span class="event">idle</span>'
        : state.recentEvents
          .map((event) => \`<span class="event">\${escapeHtml(event)}</span>\`)
          .join("\\n");

      return \`<div class="app" data-carvis-shell>
    <header class="topbar">
      <div class="brand"><span class="mark" aria-hidden="true"></span><span>Carvis</span></div>
      <div class="stats">
        <span class="stat">active \${state.runtime.activePidCount}</span>
        <span class="stat">idle \${state.runtime.idlePidCount}</span>
        <span class="stat">retained \${state.runtime.retainedPidCount}</span>
        <span class="stat">queue \${state.runtime.queueDepth}</span>
      </div>
    </header>
    <main>
      <section class="workspace" aria-label="workplaces">
        \${state.panels.map(renderPanel).join("\\n")}
      </section>
      <section class="side">
        <aside class="rail">
          <h2>Output</h2>
          <div class="stack">\${outputHtml}</div>
        </aside>
        <aside class="rail">
          <h2>Events</h2>
          <div class="stack">\${eventHtml}</div>
        </aside>
      </section>
    </main>
    <footer class="commandbar">
      <form class="command-form" data-command-form>
        <input class="command-input" name="command" autocomplete="off" value="" aria-label="Command">
        <button class="command-button" type="submit">Run</button>
      </form>
    </footer>
  </div>\`;
    }

    function bindForm() {
      const form = document.querySelector("[data-command-form]");
      const input = form?.querySelector("input[name='command']");

      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const commandText = input?.value ?? "";

        if (commandText.trim().length === 0) {
          return;
        }

        await window.carvis?.submitCommand(commandText);
        if (input) {
          input.value = "";
          input.focus();
        }
      });
    }

    function bindOutputLinks() {
      for (const control of document.querySelectorAll("[data-output-open]")) {
        control.addEventListener("click", async () => {
          await window.carvis?.openOutput(control.getAttribute("data-output-open") ?? "");
        });
      }
    }

    function scrollLogsToBottom() {
      for (const log of document.querySelectorAll(".latest, .output-report")) {
        log.scrollTop = log.scrollHeight;
      }
    }

    function render(state) {
      currentState = state;
      root.innerHTML = renderApp(currentState);
      bindForm();
      bindOutputLinks();
      scrollLogsToBottom();
    }

    bindForm();
    bindOutputLinks();
    scrollLogsToBottom();
    window.carvis?.onState((state) => render(state));
    window.carvis?.getState().then((state) => render(state));
  </script>
</body>
</html>`;
}

function renderElectronApp(state: ElectronShellState): string {
  return `<div class="app" data-carvis-shell>
    <header class="topbar">
      <div class="brand"><span class="mark" aria-hidden="true"></span><span>Carvis</span></div>
      <div class="stats">
        <span class="stat">active ${state.runtime.activePidCount}</span>
        <span class="stat">idle ${state.runtime.idlePidCount}</span>
        <span class="stat">retained ${state.runtime.retainedPidCount}</span>
        <span class="stat">queue ${state.runtime.queueDepth}</span>
      </div>
    </header>
    <main>
      <section class="workspace" aria-label="workplaces">
        ${state.panels.map(renderPanel).join("\n        ")}
      </section>
      <section class="side">
        <aside class="rail">
          <h2>Output</h2>
          <div class="stack">
            ${
              state.outputs.length === 0
                ? '<span class="event">none</span>'
                : state.outputs
                    .map(renderOutputPreview)
                    .join("\n            ")
            }
          </div>
        </aside>
        <aside class="rail">
          <h2>Events</h2>
          <div class="stack">
            ${
              state.recentEvents.length === 0
                ? '<span class="event">idle</span>'
                : state.recentEvents
                    .map((event) => `<span class="event">${escapeHtml(event)}</span>`)
                    .join("\n            ")
            }
          </div>
        </aside>
      </section>
    </main>
    <footer class="commandbar">
      <form class="command-form" data-command-form>
        <input class="command-input" name="command" autocomplete="off" value="" aria-label="Command">
        <button class="command-button" type="submit">Run</button>
      </form>
    </footer>
  </div>`;
}

function renderOutputPreview(output: ElectronOutputEntry): string {
  const files = [
    output.gamePreviewPath === undefined ? "game preview: none" : `game preview: ${output.gamePreviewPath}`,
    `final report: ${output.outputPath}`,
    output.manifestPath === undefined ? "manifest: none" : `manifest: ${output.manifestPath}`,
    ...output.manifestEntries.map((entry) => `${entry.role}: ${entry.sourcePath}`),
  ];

  return `<article class="output-preview">
  <div class="output-preview-head">
    <div class="output-folder">folder ${escapeHtml(output.outputFolderPath)}</div>
    <button class="output-link" type="button" data-output-open="${escapeAttribute(output.outputFolderPath)}">Open</button>
  </div>
  <div class="output-files">${files.map((file) => `<div>${escapeHtml(file)}</div>`).join("")}</div>
  <div class="output-report">${escapeHtml(output.previewText ?? output.previewStatus)}</div>
</article>`;
}

function renderPanel(panel: ElectronWorkplacePanel): string {
  return `<article class="panel" data-role="${escapeAttribute(panel.role)}">
  <div class="panel-header">
    <div class="role">${escapeHtml(panel.title)}</div>
    <div class="status status-${escapeAttribute(panel.status)}">${escapeHtml(panel.status)}</div>
  </div>
  <div class="meta">
    <div>pid ${panel.pid ?? "none"}</div>
    <div>${escapeHtml(panel.workplacePath)}</div>
    <div>${escapeHtml(panel.lastHeartbeatAt ?? "no heartbeat")}</div>
  </div>
  <div class="latest">${escapeHtml(panel.latestOutput ?? "waiting")}</div>
</article>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
