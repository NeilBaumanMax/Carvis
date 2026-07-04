# Carvis Development Progress

## 2026-07-04

## 2026-07-04 / Phase 8 / 完成

### 通过条件

- [x] `npm run typecheck` 通过
- [x] `npm test` 全部 8 个 smoke 通过
- [x] E2E 链路：submitTask → 7 阶段推进 → output 产物 → heartbeat → shutdown
- [x] 备份分支 `backup/pre-phase8-e2e-20260704-1730`

### 产出

- `src/e2e/smoke.ts`
- `package.json`（新增 `test` / `e2e:smoke`）
- `dos/carvis/docs/progress/layers/08-e2e.md`

---

## 2026-07-04 / Phase 8 / 开工计划

### 本轮目标

- Phase 8 集成验收：端到端链路验证。
- 实现 `src/e2e/smoke.ts`：完整走通「提交任务 → 5 角色状态流转 → output 产物 → output.ready 事件 → shutdown」。
- 建立 `npm test` 一键回归全部 smoke suite。
- 建立 `npm run e2e:smoke`。
- 确认全部 8 个 smoke 通过。

### 涉及层

- `08-e2e`
- `docs`

### 计划新增/变更

- `src/e2e/smoke.ts`（E2E 集成测试）
- `src/e2e/index.ts`（barrel export）
- `package.json`（新增 test / e2e:smoke）
- 无需修改已有模块代码（纯测试层）
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/08-e2e.md`

### 测试计划

- `npm run typecheck`
- `npm test`（全部 8 个 smoke）

### GitHub 备份计划

- 基线提交：`7dbf807`
- 备份分支：`backup/pre-phase8-e2e-20260704-1730`（已 push）

---

## 2026-07-04 / Phase 7 / 开工计划

### 本轮目标

- 完成 Phase 7：`src/agentruntime/output` 产物汇总与预览模块。
- 聚合全部角色 workplace 产物到 `output/` 目录。
- 生成 `manifest.json`（元信息清单），写入 `report.md`（最终报告）。
- 通过 messagebus 广播 `output.ready` 事件（附 outputPath + manifestPath）。
- scheduler 的 `output_ready` 阶段从 mock 替换为真实文件写入。
- 建立 `output:smoke`。

### 涉及层

- `07-output`
- `03-agentruntime`（scheduler 集成 + busClient 扩展）
- `docs`

### 计划新增/变更

- `src/agentruntime/output/manager.ts`（OutputManager：聚合结果、写 manifest.json、写 report.md）
- `src/agentruntime/output/index.ts`（barrel export）
- `src/agentruntime/output/smoke.ts`（smoke test）
- `src/agentruntime/messagebus/client.ts`（新增 publishOutputReady）
- `src/agentruntime/scheduler.ts`（output_ready 阶段接入 OutputManager）
- `package.json`（新增 output:smoke）
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/07-output.md`

### 测试计划

- `npm run typecheck`
- `npm run output:smoke`

### GitHub 备份计划

- 基线提交：`6319ef2`
- 备份分支：`backup/pre-phase7-output-20260704-1720`（已 push）

---

## 2026-07-04 / Phase 6 / 开工计划

### 本轮目标

- 完成 Phase 6：`src/agentruntime/workplaces` 角色隔间管理。
- 为 manager/writer/artist/researcher/engineer 各建独立 workplace 目录。
- 固定 `input.md` / `plan.md` / `log.md` / `result.md` 文件结构。
- 强制角色写隔离：每个角色只能写自身 workplace。
- 工程师 Agent 可读所有前置角色 workplace。
- 建立 `workplaces:smoke`。

### 涉及层

- `06-workplaces`
- `03-agentruntime`（scheduler 调用 workplace 初始化）
- `docs`

### 计划新增

- `src/agentruntime/workplaces/manager.ts`（目录初始化、读写、角色隔离检查）
- `src/agentruntime/workplaces/index.ts`（barrel export）
- `src/agentruntime/workplaces/smoke.ts`（smoke test）
- `package.json`（新增 workplaces:smoke 脚本）
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/06-workplaces.md`

### 测试计划

- `npm run typecheck`
- `npm run workplaces:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 基线提交：`c108ad9`
- 备份分支：`backup/pre-phase6-workplaces-20260704-1700`
- 远端状态：已 push

### 回滚预案

- `git revert <phase6-commit>` 回滚本轮提交
- 或删除本轮新增 `src/agentruntime/workplaces/*`，还原 `package.json` 和文档追加

---

## 2026-07-04 / Phase 5 / 开工计划

### 本轮目标

- 完成 Phase 5：`src/agentruntime/claudecode` Claude Code CLI PID 封装。
- 实现 CLI 子进程启动（`child_process.spawn`）、角色 prompt/skills 注入、stdout/stderr/exit code 捕获。
- 支持保活和统一关闭。
- 按 DeepSeek 官方 Anthropic 兼容环境变量注入（已有 `deepseekClaudeCodeEnv.ts`）。
- 建立 `claudecode:smoke`，验证启停、I/O 捕获、token 缺失报错、非零 exit code 归类、timeout 归类。

### 涉及层

- `04-claudecode`
- `03-agentruntime`（将 scheduler mock 调用改为真实 CLI 子进程）
- `docs`

### 计划修改/新增

- `src/agentruntime/claudecode/spawn.ts`（子进程启动/管理）
- `src/agentruntime/claudecode/agent.ts`（PID Agent 封装）
- `src/agentruntime/claudecode/manager.ts`（Agent 生命周期管理）
- `src/agentruntime/claudecode/index.ts`（barrel export）
- `src/agentruntime/claudecode/smoke.ts`（smoke test）
- `src/agentruntime/claudecode/README.md`（更新文档）
- `package.json`（新增 claudecode:smoke 脚本）
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/04-claudecode.md`

### 测试计划

- `npm run typecheck`
- `npm run claudecode:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 基线提交：`32bf89c2`
- 备份分支：`backup/pre-phase5-claudecode-20260704-1645`
- 远端状态：已 push

### 回滚预案

- 优先使用 `git revert <phase5-commit>` 回滚本轮代码和文档提交。
- 如仅需回滚未提交文件，删除本轮新增的 `src/agentruntime/claudecode/*`（保留已有 `deepseekClaudeCodeEnv.ts`），并还原 `package.json` 和本轮文档追加。

### 本次完成

- Phase 5 Claude Code CLI PID 封装已完成。
- 新增 `src/agentruntime/claudecode/spawn.ts`：`spawnClaudeCode()` 封装 `child_process.spawn`，支持按行 stdout/stderr 捕获、exit code、timeout、kill 信号、stdin 写入。
- 新增 `src/agentruntime/claudecode/agent.ts`：`createClaudeCodeAgent()` 将子进程包装为 PID Agent，自动路由 I/O 到 messagebus，退出时发布 `agent.done`（exit 0）或 `agent.error`（exit != 0）。`defaultRolePrompts()` 提供 5 角色默认 prompt。
- 新增 `src/agentruntime/claudecode/manager.ts`：`createAgentManager()` 管理 Agent 启动和统一 SIGTERM 关闭。
- 新增 `src/agentruntime/claudecode/index.ts`：barrel export。
- 新增 `src/agentruntime/claudecode/smoke.ts`：7 项冒烟测试（stdout/stderr 捕获、非零 exit code、timeout、stdin、kill、token 检查）。
- `package.json` 新增 `claudecode:smoke` 脚本。
- 更新 `src/agentruntime/claudecode/README.md`（架构、模块说明、smoke 覆盖）。
- 更新 `src/agentruntime/index.ts`（导出 claudecode 模块）。
- `npm run typecheck`、`npm run claudecode:smoke`、`npm run agentruntime:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke` 均通过。

### 当前未完成

- scheduler 仍使用 mock Agent 执行，尚未接入真实 Claude Code CLI 子进程（属 Phase 5+ 集成）
- workplaces 物理目录管理尚未实现（属 Phase 6）
- agentruntime 侧 MCP 桥接尚未实现

### 下一步

1. Phase 6：workplaces 隔间 — 为每个角色建立独立 workplace 目录，固定 input/plan/log/result 文件结构。

---

## 2026-07-04 / Phase 4 / 开工计划

### 本轮目标

- 完成 Phase 4：`src/agentruntime` 调度核心的最小状态机。
- 实现任务队列、PID Agent 池、心跳计时器、监督日志。
- 固定角色编排状态机：总管先启动 → 文书/美术/调研并行 → 技术等待前置 → 统一 shutdown。
- PID Agent 完成子任务后进入 `retained`，全部任务结束后统一关闭。
- 通过 messagebus 发布 `runtime.heartbeat`（含 active/idle/retained PID 数量和 queueDepth）。
- 建立 `agentruntime:smoke`，验证角色流程顺序、并发、shutdown 无残留。

### 涉及层

- `03-agentruntime`
- `02-messagebus`（runtime 侧 messagebus client）
- `shared types`
- `docs`

### 计划修改

- `src/agentruntime/README.md`
- `src/agentruntime/index.ts`
- `src/agentruntime/types.ts`
- `src/agentruntime/pool.ts`（PID Agent 池）
- `src/agentruntime/scheduler.ts`（调度状态机）
- `src/agentruntime/heartbeat.ts`（心跳计时器）
- `src/agentruntime/messagebus/client.ts`（runtime 侧 messagebus client）
- `src/agentruntime/smoke.ts`
- `src/shared/types/events.ts`（补充 agentruntime 事件 payload）
- `package.json`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`

### 测试计划

- `npm run typecheck`
- `npm run agentruntime:smoke`
- `npm run messagebus:smoke`
- `npm run setup:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 基线提交：`2942a3bd90b298857004ab3ef236a45bdd3fc9c3`
- 备份分支：`backup/pre-phase4-agentruntime-20260704-1615`
- 远端状态：已 push

### 回滚预案

- 优先使用 `git revert <phase4-commit>` 回滚本轮代码和文档提交。
- 如仅需回滚未提交文件，删除本轮新增的 `src/agentruntime/*` 文件，并还原 `package.json`、`src/shared/types/events.ts` 和本轮文档追加。

### 本次完成

- Phase 4 agentruntime 调度核心已完成。
- 新增 `src/agentruntime` 类型、AgentPool、TaskScheduler、HeartbeatTimer、RuntimeBusClient。
- TaskScheduler 驱动 RunPhase 状态机：created → manager_planning → parallel_roles_working → engineer_building → output_ready → retaining_agents → shutdown。
- 角色编排：总管先启动 → 文书/美术/调研并行 → 技术等待前置完成后启动。
- AgentPool 管理 PID Agent 生命周期：idle → starting → ready → assigned → working → done → retained → shutdown。
- HeartbeatTimer 周期性发布 `runtime.heartbeat`（含 active/idle/retained PID 数量和 queueDepth）。
- RuntimeBusClient 通过 messagebus 订阅命令、发布 agent 事件和 output。
- `npm run typecheck`、`npm run agentruntime:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke`、`npm run electron:smoke` 均通过。

### 当前未完成

- 真实 Claude Code CLI PID 启动尚未接入（属 Phase 5）
- agentruntime 侧 MCP 桥接尚未实现（属 Phase 5+）
- workplaces 物理目录管理尚未实现（属 Phase 6）

### 下一步

1. Phase 5：Claude Code CLI PID 封装，接入真实 DeepSeek 端点，建立 `claudecode:smoke`。

---

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
