# 01 Electron Progress

## 2026-07-04 / Phase 3 / 真实 Electron UI

### 当前目标

- 从 mock shell 升级为真实 Electron 窗口 + HTML/CSS renderer。

### 计划改动

- 新增 `src/electron/main.ts`：Electron 主进程，创建 BrowserWindow、实例化 MessageBus + ElectronShell、通过 IPC 桥接 renderer。
- 新增 `src/electron/preload.ts`：contextBridge 安全暴露 API。
- 新增 `src/electron/renderer/index.html` + `style.css` + `app.js`：UI 渲染层。
- 修改 `package.json`：加入 `"main"` 字段、electron 依赖、`electron:start` / `electron:dev` 脚本、build 自动复制静态资源。

### 验收指标

- BrowserWindow 可启动且加载 renderer 无错误。
- 五隔间面板（manager 通栏 + 4 列）正确渲染。
- Runtime 状态栏显示 active/idle/retained/queue 计数。
- 输入框回车提交命令，通过 IPC 调 ElectronShell.submitCommand。
- output.ready 后 Outputs 区展示产物列表和 Open 按钮。
- 窄窗口下 grid 缩为 2 列，无溢出。

### 本次完成

- 新增 `src/electron/main.ts`
- 新增 `src/electron/preload.ts`
- 新增 `src/electron/renderer/index.html`
- 新增 `src/electron/renderer/style.css`
- 新增 `src/electron/renderer/app.js`
- 修改 `package.json`：main / electron / electron:start / electron:dev / build 复制
- 安装 electron@33.4.11（需手动修复 node_modules/electron/path.txt 和 dist 解压）

### 当前状态

- 已完成：Phase 3 真实 Electron UI（主进程 + renderer + IPC）
- 进行中：无
- 未完成：Electron UI 集成到 agentruntime 端到端链路（需 ANTHROPIC_AUTH_TOKEN）

### 测试基线

- `npm run typecheck`：通过
- `npm run electron:smoke`：通过
- `npm test`：ALL 8 SMOKES PASSED
- `npm run electron:start`：窗口可正常启动

### 下一步

- 配置 ANTHROPIC_AUTH_TOKEN 后联调 Electron → messagebus → agentruntime → claude 全链路。
- MAC 签名公证（如需分发）。

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
