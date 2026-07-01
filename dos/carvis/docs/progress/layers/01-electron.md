# 01 Electron Progress

## 2026-07-02 / BrowserWindow 适配 / 本次完成

### 本次完成

- 新增 `src/electron/browserWindow.ts`，把 renderer HTML snapshot 加载进 Electron `BrowserWindow`。
- 新增 `src/electron/browserMain.ts`，供真实 Electron runtime 启动窗口。
- 新增 `electron:browser-smoke`，验证 BrowserWindow 参数、sandbox webPreferences、`loadFile()` 和 `ready-to-show` 显示路径。
- 新增 `electron:visual-smoke`，需要外部 Electron runtime，验证真实 X11 窗口截图。
- NixOS 上使用 `nixpkgs#electron` 运行真实视觉 smoke，Electron 版本 `v41.7.2`。
- `npm test` 已包含 `electron:browser-smoke`。

### 测试基线

- 本地 `npm run electron:browser-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `electron:visual-smoke` with `nixpkgs#electron`：通过，生成 `/tmp/carvis-electron-visual-smoke/carvis-electron-visual-smoke.png`。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- 项目尚未引入 Electron npm runtime 依赖；真实窗口入口当前依赖 NixOS `nixpkgs#electron`。
- systemd 仍运行 Node shell 入口，尚未切换到真实 Electron window 入口。

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
