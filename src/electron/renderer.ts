import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ElectronShellState, ElectronWorkplacePanel } from "./types.js";

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
      gap: 16px;
      padding: 14px 18px;
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
      gap: 10px;
      min-width: 0;
      font-weight: 700;
      font-size: 18px;
    }

    .mark {
      width: 28px;
      height: 28px;
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
      padding: 6px 9px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.2;
      white-space: nowrap;
      cursor: pointer;
      font: inherit;
      text-align: left;
    }

    .workspace {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      padding: 14px;
      align-items: stretch;
    }

    .panel {
      min-width: 0;
      min-height: 300px;
      display: grid;
      grid-template-rows: auto auto 1fr;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 12px;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }

    .role {
      overflow-wrap: anywhere;
      font-size: 15px;
      font-weight: 700;
    }

    .status {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 4px 8px;
      color: #ffffff;
      font-size: 11px;
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
      gap: 5px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
      min-width: 0;
    }

    .meta div,
    .output-link,
    .event {
      overflow-wrap: anywhere;
    }

    .latest {
      min-height: 120px;
      border: 1px solid #e8edf3;
      border-radius: 8px;
      padding: 10px;
      background: #fbfcfd;
      color: #344054;
      font-size: 13px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .side {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
      gap: 12px;
      padding: 0 14px 14px;
    }

    .rail {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
      padding: 12px;
      min-width: 0;
    }

    .rail h2 {
      margin: 0 0 10px;
      font-size: 14px;
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
      height: 42px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 12px;
      color: var(--ink);
      font: inherit;
      font-size: 14px;
      background: #ffffff;
    }

    .command-button {
      height: 42px;
      border: 0;
      border-radius: 8px;
      padding: 0 16px;
      color: #ffffff;
      background: var(--blue);
      font-weight: 700;
      cursor: pointer;
    }

    @media (max-width: 1100px) {
      .workspace {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

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

    function renderApp(state) {
      const outputHtml = state.outputs.length === 0
        ? '<span class="event">none</span>'
        : state.outputs
          .map((output) => \`<button class="output-link" type="button" data-output-open="\${escapeHtml(output.outputPath)}">\${escapeHtml(output.outputPath)}</button>\`)
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

    function render(state) {
      currentState = state;
      root.innerHTML = renderApp(currentState);
      bindForm();
      bindOutputLinks();
    }

    bindForm();
    bindOutputLinks();
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
                    .map(
                      (output) =>
                        `<button class="output-link" type="button" data-output-open="${escapeAttribute(output.outputPath)}">${escapeHtml(output.outputPath)}</button>`,
                    )
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
