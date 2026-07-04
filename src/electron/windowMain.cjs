const { app, BrowserWindow } = require("electron");

let mainWindow;

async function createWindow() {
  console.log("[electron-window] creating Carvis window");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "Carvis",
    backgroundColor: "#f7f8fa",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });

  mainWindow.once("ready-to-show", () => {
    console.log("[electron-window] ready to show");
    mainWindow.show();
    mainWindow.focus();
    mainWindow.moveTop();
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`[electron-window] failed to load: ${errorCode} ${errorDescription}`);
  });

  await mainWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(createHtml())}`);
  console.log("[electron-window] html loaded");
}

app.setName("Carvis");

process.on("uncaughtException", (error) => {
  console.error("[electron-window] uncaught exception", error);
});

process.on("unhandledRejection", (error) => {
  console.error("[electron-window] unhandled rejection", error);
});

app.whenReady().then(async () => {
  console.log("[electron-window] app ready");
  await createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function createHtml() {
  return String.raw`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Carvis</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f8fa;
        --surface: #ffffff;
        --line: #d9dee7;
        --text: #1d2430;
        --muted: #667085;
        --green: #0b7a55;
        --blue: #2457c5;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-width: 860px;
        background: var(--bg);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .app {
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: 100vh;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 18px 24px;
        border-bottom: 1px solid var(--line);
        background: var(--surface);
      }

      h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
      }

      .statusbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: flex-end;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        height: 30px;
        padding: 0 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fbfcfe;
        color: var(--muted);
        font-size: 13px;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--green);
      }

      main {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 18px;
        padding: 18px;
        min-height: 0;
      }

      .panels {
        display: grid;
        grid-template-columns: repeat(2, minmax(260px, 1fr));
        gap: 14px;
        align-content: start;
      }

      .panel,
      aside,
      footer {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
      }

      .panel {
        min-height: 176px;
        padding: 14px;
        display: grid;
        grid-template-rows: auto auto 1fr;
        gap: 12px;
      }

      .panel.engineer {
        grid-column: 1 / -1;
      }

      .panel-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }

      .panel h2,
      aside h2 {
        margin: 0;
        font-size: 16px;
      }

      .badge {
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 650;
        color: var(--green);
        background: #e8f5ef;
      }

      .path {
        color: var(--muted);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }

      .output {
        color: #344054;
        font-size: 14px;
        line-height: 1.48;
        white-space: pre-wrap;
      }

      aside {
        padding: 14px;
        display: grid;
        grid-template-rows: auto auto 1fr;
        gap: 14px;
        min-height: 0;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      .metric {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px;
        background: #fbfcfe;
      }

      .metric strong {
        display: block;
        font-size: 20px;
      }

      .metric span,
      .event {
        color: var(--muted);
        font-size: 12px;
      }

      .events {
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow: auto;
        min-height: 180px;
      }

      .event {
        border-bottom: 1px solid #edf0f5;
        padding-bottom: 8px;
      }

      footer {
        margin: 0 18px 18px;
        padding: 14px;
      }

      form {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
      }

      input {
        width: 100%;
        min-width: 0;
        height: 44px;
        border: 1px solid #c7ced9;
        border-radius: 8px;
        padding: 0 13px;
        font-size: 15px;
      }

      button {
        width: 104px;
        height: 44px;
        border: 0;
        border-radius: 8px;
        background: var(--blue);
        color: white;
        font-size: 15px;
        font-weight: 700;
      }

      @media (max-width: 1080px) {
        main {
          grid-template-columns: 1fr;
        }

        aside {
          min-height: 280px;
        }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <header>
        <div>
          <h1>Carvis</h1>
        </div>
        <div class="statusbar">
          <span class="pill"><span class="dot"></span> messagebus ready</span>
          <span class="pill"><span class="dot"></span> agentruntime ready</span>
          <span class="pill"><span class="dot"></span> electron ready</span>
        </div>
      </header>

      <main>
        <section class="panels" id="panels"></section>
        <aside>
          <h2>Runtime</h2>
          <div class="metrics">
            <div class="metric"><strong id="active">0</strong><span>active PID</span></div>
            <div class="metric"><strong id="idle">5</strong><span>idle PID</span></div>
            <div class="metric"><strong id="retained">0</strong><span>retained PID</span></div>
            <div class="metric"><strong id="queue">0</strong><span>queue depth</span></div>
          </div>
          <div class="events" id="events"></div>
        </aside>
      </main>

      <footer>
        <form id="command-form">
          <input id="command-input" autocomplete="off" placeholder="输入命令，按回车提交" />
          <button type="submit">发送</button>
        </form>
      </footer>
    </div>

    <script>
      const roles = [
        ["manager", "Manager", "拆解任务并分配角色"],
        ["writer", "Writer", "处理文本、文案和结构说明"],
        ["artist", "Artist", "处理视觉、素材和界面方向"],
        ["researcher", "Researcher", "处理资料、事实和方案调研"],
        ["engineer", "Engineer", "汇总前置结果并生成 output"]
      ];

      const panels = document.getElementById("panels");
      const events = document.getElementById("events");
      const active = document.getElementById("active");
      const idle = document.getElementById("idle");
      const retained = document.getElementById("retained");
      const queue = document.getElementById("queue");

      for (const [role, title, text] of roles) {
        const panel = document.createElement("article");
        panel.className = "panel " + role;
        panel.dataset.role = role;
        panel.innerHTML = '<div class="panel-top"><h2>' + title + '</h2><span class="badge">idle</span></div><div class="path">workplaces/' + role + '</div><div class="output">' + text + '</div>';
        panels.appendChild(panel);
      }

      function addEvent(text) {
        const node = document.createElement("div");
        node.className = "event";
        node.textContent = new Date().toLocaleTimeString() + "  " + text;
        events.prepend(node);
      }

      function setPanel(role, status, text) {
        const panel = document.querySelector('[data-role="' + role + '"]');
        panel.querySelector(".badge").textContent = status;
        panel.querySelector(".output").textContent = text;
      }

      document.getElementById("command-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.getElementById("command-input");
        const command = input.value.trim();
        if (!command) return;
        input.value = "";

        addEvent("command.submitted: " + command);
        queue.textContent = "1";
        active.textContent = "1";
        idle.textContent = "4";
        setPanel("manager", "working", "正在拆解命令: " + command);

        window.setTimeout(() => {
          setPanel("manager", "retained", "任务已拆解，PID 保持挂起");
          setPanel("writer", "working", "文书 Agent 已接收任务");
          setPanel("artist", "working", "美术 Agent 已接收任务");
          setPanel("researcher", "working", "调研 Agent 已接收任务");
          active.textContent = "3";
          idle.textContent = "1";
          queue.textContent = "0";
          addEvent("parallel roles working");
        }, 500);

        window.setTimeout(() => {
          setPanel("writer", "retained", "文书阶段完成");
          setPanel("artist", "retained", "美术阶段完成");
          setPanel("researcher", "retained", "调研阶段完成");
          setPanel("engineer", "working", "技术 Agent 正在汇总 output");
          active.textContent = "1";
          retained.textContent = "4";
          addEvent("engineer building output");
        }, 1100);

        window.setTimeout(() => {
          setPanel("engineer", "retained", "output/final-report.md 已准备");
          active.textContent = "0";
          retained.textContent = "5";
          addEvent("output.ready: output/final-report.md");
        }, 1700);
      });

      addEvent("Carvis window ready");
    </script>
  </body>
</html>`;
}
