# 01 Electron Progress

## 2026-07-04 / Phase 4 / 开工计划

### 当前目标

- 补齐 Electron mock 的本地长跑入口，让完整启动命令能实际拉起前端展示进程占位。

### 计划改动

- 新增或调整 Electron mock 进程入口。
- 保持 Electron 不直接管理 PID、不绕过 messagebus、不读写 workplace。

### 验收指标

- `npm run electron:smoke` 通过。
- 完整启动 smoke 能看到 Electron mock 入口被 setup 拉起。

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
