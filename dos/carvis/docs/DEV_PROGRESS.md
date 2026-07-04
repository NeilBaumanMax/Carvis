# Carvis Development Progress

## 2026-07-04 / Phase 4 / 开工计划

### 本轮目标

- 处理当前项目无法完整运行的问题，补齐本地完整启动需要的最小可运行进程入口。
- 让 `setup` 的 spawn 模式能够实际拉起 `messagebus`、`agentruntime` 和 Electron mock 进程。
- 新增一个面向本机运行的完整启动命令，避免用户只能看到 plan 模式。

### 涉及层

- `00-setup`
- `01-electron`
- `02-messagebus`
- `03-agentruntime`
- `docs`

### 计划修改

- `package.json`
- `.gitignore`
- `src/setup/*`
- `src/messagebus/*`
- `src/agentruntime/*`
- `src/electron/*`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/00-setup.md`
- `dos/carvis/docs/progress/layers/01-electron.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`

### 测试计划

- `npm run typecheck`
- `npm run setup:smoke`
- `npm run messagebus:smoke`
- `npm run electron:smoke`
- `npm run agentruntime:smoke`
- `npm run start:full:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 基线提交：`7febca6cc283507bff1ff033ac99486bb652ec2c`
- 备份分支：`backup/pre-phase4-full-run-20260704-1019`
- 远端状态：待 push 到 `origin`，不使用 `upstream`

### 回滚预案

- 优先使用 `git revert <phase4-full-run-commit>` 回滚本轮代码和文档提交。
- 如仅需回滚未提交文件，删除本轮新增的 agentruntime/messagebus/electron 入口文件，并还原 `package.json`、`.gitignore` 和相关文档追加。

### 本次完成

- 新增 `npm start` 默认完整启动，内部执行 `npm run start:full`。
- 保留 `npm run start:plan` 作为原 plan 模式入口。
- 新增 `messagebus`、`agentruntime`、Electron mock 的本地长跑入口。
- 新增 setup spawn 模式的子进程持有和统一 shutdown 能力。
- 新增 `agentruntime:smoke`，验证最小角色顺序、heartbeat 和 output ready。
- 新增 `start:full:smoke`，验证 setup 能实际拉起并关闭三类核心进程。
- `npm start` 已实际运行成功，显示 messagebus、agentruntime、Electron mock 全部 ready。

### 当前未完成

- 当前 Electron 仍是 mock shell，不是真实窗口。
- 当前 messagebus 仍是内存协议，不是跨进程 IPC/WebSocket。
- 当前 agentruntime 仍是 mock 状态机，不启动真实 Claude Code PID Agent。

### 下一步

1. 继续 Phase 4：把 agentruntime 从 mock 状态机推进到可接收 `command.submitted` 的运行时。
2. 后续 Phase 5：接入 Claude Code CLI PID Agent 封装。
3. 后续实现真实 Electron renderer 窗口和跨进程 messagebus。

## 2026-07-01

## 2026-07-01 / Phase 3 / 开工计划

### 本轮目标

- 完成 Phase 3：`src/electron` 可视化外壳的最小可运行版本。
- 建立五个 workplace 面板状态模型：manager、writer、artist、researcher、engineer。
- 建立 Electron mock shell，通过 messagebus 发布 `command.submitted`，订阅 `runtime.heartbeat` 和 `output.ready` 并更新展示状态。
- 建立 `electron:smoke`，验证输入命令、心跳展示和 output 入口展示。

### 涉及层

- `01-electron`
- `02-messagebus`
- `shared types`
- `docs`

### 计划修改

- `src/electron/README.md`
- `src/electron/types.ts`
- `src/electron/shell.ts`
- `src/electron/index.ts`
- `src/electron/smoke.ts`
- `src/shared/types/events.ts`
- `package.json`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/01-electron.md`

### 测试计划

- `npm run typecheck`
- `npm run electron:smoke`
- `npm run messagebus:smoke`
- `npm run setup:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 基线提交：`a0f5a06aa78e286fab13de0047ccdea8ebc37b4f`
- 备份分支：`backup/pre-phase3-electron-20260701-2343`
- 远端状态：待 push 备份分支

### 回滚预案

- 优先使用 `git revert <phase3-commit>` 回滚本轮代码和文档提交。
- 如仅需回滚未提交文件，删除本轮新增的 `src/electron/*`，并还原 `package.json`、`src/shared/types/events.ts` 和本轮文档追加。

### 本次完成

- Phase 3 Electron mock shell 已完成。
- 新增 `src/electron` README、状态类型、shell、入口和 smoke 脚本。
- 默认状态包含 manager、writer、artist、researcher、engineer 五个隔间。
- 输入命令会发布 `command.submitted` 到 `agentruntime`。
- `runtime.heartbeat` 会更新 Electron runtime 展示状态。
- `output.ready` 会创建 output 展示入口。
- `npm run typecheck`、`npm run electron:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke` 均通过。
- 远程 SSH 调试已连接 `howtion@192.168.137.59`，确认 NixOS、Node、npm、git 可用。
- 已连接远端 WiFi `kyle`，默认出网路由走 `wlan0`，有线保留用于 SSH。
- 已同步到远端 `~/carvis-remote-smoke`，远端干净 `npm ci` 后，`npm run typecheck`、`npm run electron:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke` 均通过。

### 当前未完成

- 真实 Electron 窗口和 renderer UI 尚未实现。
- 桌面与窄窗口视觉验收尚未建立。
- output 打开真实文件的能力尚未实现。

### 下一步

1. Phase 4：实现 agentruntime 调度核心的最小状态机。
2. 让 agentruntime 通过 messagebus 发布 `runtime.heartbeat`。
3. 后续真实 Electron 窗口建立后做桌面与窄窗口视觉验收。

## 2026-07-01 / Phase 2 / 开工计划

### 本轮目标

- 完成 Phase 2：`src/messagebus` 本地事件协议第一版。
- 建立 mock Electron 到 mock agentruntime 的 `command.submitted` 转发验证。
- 建立 mock agentruntime 到 mock Electron 的 `runtime.heartbeat` 广播验证。
- 保持 messagebus 只负责 envelope、订阅、发布和转发，不执行任务、不读写 workplace。

### 涉及层

- `02-messagebus`
- `shared types`
- `docs`

### 计划修改

- `src/messagebus/README.md`
- `src/messagebus/types.ts`
- `src/messagebus/bus.ts`
- `src/messagebus/index.ts`
- `src/messagebus/smoke.ts`
- `src/shared/types/events.ts`
- `package.json`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`

### 测试计划

- `npm run typecheck`
- `npm run messagebus:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 当前基线提交：`fabbd3f`
- 计划备份分支：`backup/pre-phase2-messagebus-20260701-2145`
- 远端状态：待 push 备份分支

### 回滚预案

- 优先使用 `git revert <phase2-commit>` 回滚本轮代码和文档提交。
- 如仅需回滚未提交文件，删除本轮新增的 `src/messagebus/*`，并还原 `package.json`、`src/shared/types/events.ts` 和本轮文档追加。

## 2026-07-01 / Phase 1 / 开工计划

### 本轮目标

- 完成 Phase 1：`setup` 启动协议的第一版可运行代码。
- 保持代码解耦、可读、简洁，按 `setup -> messagebus / agentruntime / electron` 边界开发。
- 建立 `setup:smoke`，验证本地模拟启动顺序和失败处理。

### 涉及层

- `00-setup`
- `shared config/types`
- `docs`

### 计划修改

- `src/setup/README.md`
- `src/setup/types.ts`
- `src/setup/config.ts`
- `src/setup/supervisor.ts`
- `src/setup/index.ts`
- `src/bootstrap.ts`
- `package.json`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/00-setup.md`

### 测试计划

- `npm run typecheck`
- `npm run setup:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 当前基线提交：`20c1666`
- 计划提交本轮开工计划后创建备份分支：`backup/pre-phase1-setup-<timestamp>`
- 远端状态：待 push 备份分支

### 回滚预案

- 优先使用 `git revert <phase1-commit>` 回滚本轮代码提交。
- 如果仅需回滚未提交文件，删除或还原本轮新增的 `src/setup/*` 和 `package.json` 脚本改动。

### 进行中

- 建立面向 `carvis` 的施工文档脚手架
- 将 catnip 单 Agent CLI 文档模式迁移为 NixOS 多进程多 Agent 可视化系统文档模式

### 已完成

- Phase 2 messagebus 事件协议代码完成
- 新增 `src/messagebus` README、类型、总线实现、入口和 smoke 脚本
- `command.submitted` 可从 mock Electron 转发给 mock agentruntime
- `runtime.heartbeat` 可从 mock agentruntime 广播给 mock Electron
- envelope 可自动补齐 `eventId` 和 `timestamp`
- `npm run messagebus:smoke` 通过
- 读取根目录 `对参考施工文档重构的要求 .txt`
- 读取 `dos/catnip` 的主施工文档、架构文档、施工计划、进度日志、施工日志格式
- 确认 `参考施工文档` 目录当前为空
- 确认当前 `src` 目录只有结构目录，尚无源码文件
- 创建 `dos/carvis` 文档脚手架
- 创建 `docs/GITHUB_ROLLBACK.md`
- 创建 `docs/TEST_METRICS.md`
- 创建 `docs/WORKFLOW.md`
- 创建 `docs/HANDOFF.md`
- 固定每次开工先写计划、每次结束先写日志
- 固定标准闭环：计划 -> GitHub 备份 -> 施工 -> 施工记录 -> 测试日志 -> 失败返工复测 -> 文档漂移修正 -> 接力文档 -> 上传 GitHub
- 初始化本地 Git 仓库
- 绑定 GitHub remote：`git@github.com:howtion0/carvis.git`
- 推送开发前备份分支：`backup/pre-carvis-bootstrap-20260701-203039`
- 推送 Phase 1 开发前备份分支：`backup/pre-phase1-setup-20260701-203615`
- 已连接 NixOS 主机：`howtion@192.168.137.59`
- 创建 TypeScript 工程骨架：`package.json`、`tsconfig.json`、`src/main.ts`、`src/bootstrap.ts`
- 创建共享类型：Agent、Run、MessageBus event envelope
- 创建 `src/agentruntime/claudecode/deepseekClaudeCodeEnv.ts`
- 根据 DeepSeek 官方文档固定 Claude Code CLI 的 Anthropic 兼容环境变量
- `npm install` 通过
- `npm run typecheck` 通过
- Phase 1 setup 启动协议代码完成
- 创建 `src/setup` 类型、配置、supervisor、README、smoke 脚本
- `bootstrap` 接入 setup plan 模式
- `package.json` 新增 `setup:smoke`
- `npm run setup:smoke` 通过
- `npm start` 通过，默认 plan 模式输出启动顺序 `messagebus -> agentruntime -> electron`
- 固定 `setup / electron / messagebus / agentruntime` 四大顶层职责
- 固定 `agentruntime/claudecode / mcp / messagebus / workplaces` 子层职责
- 固定总管、文书、美术、调研、技术 Agent 的协作顺序
- 固定 PID Agent 保活和统一关闭规则
- 固定心跳主归属 `agentruntime`，传播归属 `messagebus`，展示归属 `electron`

### 未开始

- 根目录 `src/*/README.md`
- `src/agentruntime/README.md`
- `src/electron/README.md`
- Claude Code CLI 子进程真实启动
- agentruntime 调度代码
- Electron UI
- Claude Code CLI PID 封装
- DeepSeek 环境变量接入
- smoke test

### 下一步

1. Phase 3：实现 Electron 可视化外壳的最小可运行版本。
2. 为 `src/electron` 补 README。
3. 建立 `electron:smoke`，验证输入命令发布 `command.submitted`。
4. 让 Electron mock 能订阅 `runtime.heartbeat` 并展示状态。

### 备注

本文件作为实时开发进度日志持续追加，不覆盖旧记录。
