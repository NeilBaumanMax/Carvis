# 01 Electron Progress

## 2026-07-03 / Install carvisui as production Electron renderer / 开工计划

### 当前目标

- 用用户提供的 `carvisui` React/Vite 页面替换当前 Electron renderer。
- 保留 UI 已经写好的像素办公室、角色动作、气泡流式文字和信件轨迹。
- 把 UI 角色映射到 Carvis 真实角色：主管=`manager`，文员=`writer`，设计=`artist`，调研=`researcher`，技术=`engineer`。
- 右侧面板接入真实 Electron shell：输入提交到 messagebus，output 展示本轮生成文件，历史展示全部已有 output run 文件夹并可打开。
- 左上角标题改为 `Carvis`。

### 计划改动

- Electron 主进程继续只通过 preload 暴露受控 IPC，不让 renderer 直接管理 PID 或读写 workplace。
- BrowserWindow 加载构建后的 `carvisui` 静态页面；保留旧 HTML snapshot 作为 smoke fallback/测试辅助。
- UI hook 由模拟 workflow 改成监听 `ElectronShellState`，根据 agent lifecycle/output/output.ready 推动状态、气泡和信件动画。
- 新增或调整 UI smoke，确认新页面可渲染、可提交命令、可打开 output/history。

### 验收指标

- NixOS `carvis-electron.service` 打开的窗口显示 `Carvis` 和用户 UI，而不是旧五列终端面板。
- 未提交任务时五角色静止。
- 提交任务后 manager/writer/artist/researcher/engineer 的公开输出进入对应气泡，角色动作按 UI 轨迹推进。
- output 区展示最新 run 文件，历史区可打开历史 run 文件夹。
- NixOS 截图验证页面无明显空白、重叠或资源丢失。

### 本次完成

- `carvisui` React/Vite 页面已成为默认 Electron renderer。
- BrowserWindow 默认加载 `dist/electron/carvisui/index.html`，旧 snapshot renderer 仅作为 fallback。
- UI 通过 preload IPC 接入 Carvis shell state 和命令提交。
- `assetPath()` 修复 Electron `file://` 下图标、角色、气泡、信件图片路径。
- output/history 默认从 `output/runs/*` 回填，历史回填不会自动打开预览窗口。
- `CARVIS_AUTO_OPEN_GAME_PREVIEW` 改为显式 `1` 才自动打开，默认只在右侧 output 提供打开入口。

### 当前验证

- 本地 `npm test`：通过。
- NixOS `electron:visual-smoke`：通过，截图 `/tmp/carvis-electron-visual-smoke/carvis-electron-visual-smoke.png`。
- NixOS 主 UI 截图 `/tmp/carvis-ui-final-main.png`：显示 `Carvis`、五角色像素办公室、右侧输入/output/history。
- NixOS 四个真实任务均生成 output，并在 history/output 中可见。

## 2026-07-03 / NixOS readback and drift fix / 开工计划

### 当前目标

- 用远端 NixOS readback 修正 Electron 文档中全屏历史状态和当前 windowed live renderer 状态的混杂描述。

### 计划改动

- 当前状态保留为 `1000x640` windowed live renderer。
- 记录远端 `carvis-electron.service` active，入口为 `dist/electron/runBrowserMain.js`，通过 NixOS Electron 41.7.2 runtime 启动。
- 历史全屏/kiosk 段落只作为历史记录，不作为当前验收标准。

### 验收指标

- 文档不再把旧 `1280x720+0+0` 全屏状态写成当前设计。
- `npm run typecheck` 和 `npm run build` 通过。

## 2026-07-02 / Current windowed live renderer / 当前状态

### 当前事实

- 真实 Electron 入口是 `dist/electron/runBrowserMain.js`，由 NixOS user service `carvis-electron.service` 运行。
- BrowserWindow 默认 `1000x640`、`center=true`，默认 `fullscreen=false`、`kiosk=false`。
- 远端 1280x720 屏幕上复核位置为 `140,40`，即 `1000x640` 居中窗口。
- 1000px 宽度下五个 agent 面板保持一行，全部同屏露出。
- Renderer 是 live renderer：通过 preload IPC 调用 `getState`、`submitCommand`、`onState`、`openOutput`。
- agent 输出区是深色终端风格，显示公开进度/输出摘要；不显示隐藏思考链。
- Output 区显示产物文件夹预览，包含 `final-report.md`、`manifest.json`、`game-preview.html` 和五个 role result。

### 当前验证

- 本地 `npm test`：通过。
- 远端 NixOS `npm run build`：通过。
- 远端 `carvis-electron.service`：active。
- 远端截图 `/tmp/carvis-1000x640-window.png`：五个 agent 面板同屏露出。
- 远端任务截图 `/tmp/carvis-deck-tower.png`：原创爬塔卡牌任务已在窗口内显示中文输出。

### 漂移提醒

- 下方早期段落中关于 `1280x720+0+0` 全屏/kiosk 的记录是历史状态，不代表当前设计。

## 2026-07-02 / Live renderer IPC / 本次完成

### 本次完成

- BrowserWindow renderer 增加 preload IPC 桥，提供 `getState`、`submitCommand`、`onState`。
- `browserMain.ts` 负责 IPC handler 和 state push；renderer 不直接连接 messagebus，也不直接调用 agentruntime。
- Renderer 页面可在真实 Electron 窗口内提交命令，并在 shell state 变化时重绘五角色面板、runtime stats、output、events。
- Output 入口通过 IPC 调用主进程 open path。
- `electron:visual-smoke` 已覆盖真实窗口内 submit、live DOM update 和 output open 请求。
- NixOS systemd `carvis-electron.service` 重启后仍为全屏。

### 测试基线

- 本地 `npm run electron:browser-smoke`：通过。
- 本地 `npm run electron:ui-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `electron:visual-smoke` with `nixpkgs#electron`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `carvis-electron.service` 重启后全屏验收：通过。

### 剩余风险

- 本层当前 MVP 阶段无阻塞风险。

## 2026-07-02 / NixOS fullscreen 复验 / 本次完成

### 本次完成

- 复核远端 NixOS 上 `carvis-electron.service` 使用真实 Electron BrowserWindow runner。
- 复核 X11 窗口树：root `1280x720`，`Carvis` 窗口 `1280x720+0+0`。
- 复核当前会话屏幕休眠：screen saver timeout 为 `0`，DPMS disabled。

### 测试基线

- 远端 NixOS `xwininfo -root -tree`：`Carvis` 窗口 `1280x720+0+0`。
- 远端 NixOS `xset q`：screen saver timeout `0`，DPMS disabled。

### 剩余风险

- 已在后续 Live renderer IPC 记录中补齐实时状态更新和输入提交。

## 2026-07-02 / BrowserWindow 适配 / 本次完成

### 本次完成

- 新增 `src/electron/browserWindow.ts`，把 renderer HTML snapshot 加载进 Electron `BrowserWindow`。
- 新增 `src/electron/browserMain.ts`，供真实 Electron runtime 启动窗口。
- 新增 `electron:browser-smoke`，验证 BrowserWindow 参数、sandbox webPreferences、`loadFile()` 和 `ready-to-show` 显示路径。
- 新增 `electron:visual-smoke`，需要外部 Electron runtime，验证真实 X11 窗口截图。
- NixOS 上使用 `nixpkgs#electron` 运行真实视觉 smoke，Electron 版本 `v41.7.2`。
- BrowserWindow 默认 fullscreen/kiosk，并重复应用 fullscreen/kiosk 处理开机 KWin/Plasma 竞态。
- systemd `carvis-electron.service` 已切换到 `node dist/electron/runBrowserMain.js`，通过 `CARVIS_ELECTRON_BIN` 调用 NixOS Electron runtime。
- `npm test` 已包含 `electron:browser-smoke`。

### 测试基线

- 本地 `npm run electron:browser-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `electron:visual-smoke` with `nixpkgs#electron`：通过，生成 `/tmp/carvis-electron-visual-smoke/carvis-electron-visual-smoke.png`。
- 远端 NixOS 重启后全屏验收：通过，`Carvis` 窗口 `1280x720+0+0`。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- 项目尚未引入 Electron npm runtime 依赖；真实窗口入口当前依赖 NixOS `nixpkgs#electron`。
- renderer 当前仍是 snapshot 文件，后续需要做实时 DOM 更新和输入提交。

## 2026-07-01 / Phase 3 / 开工计划

### 当前目标

- 实现 Electron 可视化外壳的最小可运行版本，先用 TypeScript mock shell 固定 UI 状态和 messagebus 交互协议。

### 计划改动

- 新增 `src/electron/README.md`，固定 Electron 当前职责、输入规则和禁止事项。
- 新增 Electron 状态模型和 shell，包含五个 workplace 面板、运行时心跳状态、最近事件和 output 入口。
- 新增 `electron:smoke`，验证命令提交、心跳订阅和 output ready 展示。
- 在 `package.json` 增加 `electron:smoke`。

### 验收指标

- 默认状态包含 manager、writer、artist、researcher、engineer 五个隔间。
- 输入命令后通过 messagebus 发布 `command.submitted`。
- 收到 `runtime.heartbeat` 后 Electron 状态展示 active/idle/retained PID 和 queueDepth。
- 收到 `output.ready` 后 Electron 状态展示产物入口。
- Electron 不直接管理 PID、不绕过 messagebus、不读写 workplace。

### 本次完成

- 新增 `src/electron/README.md`
- 新增 `src/electron/types.ts`
- 新增 `src/electron/shell.ts`
- 新增 `src/electron/index.ts`
- 新增 `src/electron/smoke.ts`
- 新增 `npm run electron:smoke`
- Electron mock shell 可提交命令、展示 heartbeat、展示 output ready 入口。

### 当前状态

- 已完成：Phase 3 最小 TypeScript mock shell 和 smoke test
- 进行中：无
- 未完成：真实 Electron 窗口、renderer UI、响应式视觉验收、真实 output 打开能力

### 测试基线

- `npm run typecheck`：通过
- `npm run electron:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过

### 下一步

- 拿到 SSH 凭据后在 NixOS 目标机复测。
- Phase 4 开始实现 agentruntime 调度核心和 heartbeat 发布。

## 2026-07-01 / Phase 0 / 初始化

### 当前目标

固定 Electron 的展示、输入和 output 预览职责。

### 本次完成

- 明确 Electron 通过 messagebus 发送命令和订阅状态
- 明确 Electron 显示多个 workplace 隔间
- 明确输入框使用回车提交命令
- 明确 Electron 可预览和打开 `output/` 产物

### 当前状态

- 已完成：文档边界
- 进行中：无
- 未完成：UI 状态模型、窗口骨架、messagebus client

### 下一步

- 补 `src/electron/README.md`
- 定义 workplace 面板状态字段

## 2026-07-02 / NixOS MVP 验收 / 补充

### 本次完成

- Electron shell 在 `e2e:smoke` 中展示五角色 panel、PID、状态、最近输出和 output ready 入口。
- `mvp:real-smoke` 验证真实 Claude Code 五角色输出完成后 Electron shell 状态进入 shutdown，并能看到产物入口。

### 测试基线

- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- 当前仍是 TypeScript shell/mock 状态模型，不是真实 Electron renderer 窗口。
- 尚未完成响应式 UI 截图验收和真实文件打开动作。

## 2026-07-02 / 跨进程 IPC / 本次完成

### 本次完成

- `electron/main.ts` 连接 TCP messagebus。
- 新增 `CARVIS_ELECTRON_SUBMIT_ON_START`，方便真实入口 smoke 提交一条启动命令。
- `ipc:smoke` 使用 Electron shell 作为 TCP client，验证五角色状态和 `output.ready` 可跨进程回传。

### 测试基线

- 本地 `npm run ipc:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。

### 剩余风险

- 真实 Electron renderer UI 仍未实现。

## 2026-07-02 / Renderer Snapshot / 本次完成

### 本次完成

- 新增 `src/electron/renderer.ts`，可把 shell state 渲染为真实 HTML/CSS 工作台。
- 新增 `electron:ui-smoke`，验证五角色面板、命令输入、output 入口和窄屏 CSS。
- `electron/main.ts` 支持 `CARVIS_ELECTRON_RENDERER_DIR` 写出 renderer snapshot。

### 测试基线

- 本地 `npm run electron:ui-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- HTML renderer 尚未挂载到真实 Electron `BrowserWindow`。
- 尚未做截图级视觉验收。
