# Carvis Construction Log

## 2026-07-04 / Phase 9 / Claude Code CLI 接入

### 本轮计划回放

- 扩增 RuntimeConfig：ExecutionMode 类型（mock / claude）
- 重写 scheduler 支持双模式：`executeSequentialClaude` / `executeParallelClaude`
- Claude 模式：通过 AgentManager 启动真实 Claude Code 子进程
- 写入 workplace input.md → waitForExit → 写入 result.md
- 自动降级：CLI 不可用时 fallback 到 mock

### 实施记录

#### 变更文件

- `src/agentruntime/types.ts`：新增 `ExecutionMode`、`claudeTimeoutMs`
- `src/agentruntime/scheduler.ts`：新增 `executeSequentialClaude` / `executeParallelClaude`
- `src/agentruntime/index.ts`：导出 `isClaudeCodeAvailable`
- `src/e2e/claude-smoke.ts`：claude 模式 E2E smoke
- `package.json`：新增 `e2e:claude-smoke`

#### 测试结果

| Suite | 结果 |
|---|---|
| `npm test`（8 smokes） | ALL PASSED，零回归 |
| `npm run e2e:claude-smoke` | SKIP（优雅降级，无 CLI） |

### 遗留项与下一步

- Claude CLI 需在 `keys.txt` 配置有效的 API Key 才能真实运行
- 需要 Phase 10+ 接入 MCP 或 Electron 前端事件订阅

---

## 2026-07-04 / Phase 8 / 集成验收

### 本轮计划回放

- 实现 `src/e2e/smoke.ts`：端到端集成测试
- 建立 `npm test` 一键回归（全部 8 个 smoke）
- 建立 `npm run e2e:smoke`
- 验证完整链路：提交任务 → 5 角色 → output 产物 → output.ready 事件 → shutdown

### 实施记录

#### 新增文件

- `src/e2e/smoke.ts`（E2E 集成 smoke）
- `src/e2e/index.ts`（barrel export）

#### 变更文件

- `package.json`（新增 `test` 和 `e2e:smoke` 脚本）

#### 测试结果

| Suite | 结果 |
|---|---|
| setup:smoke | ok |
| messagebus:smoke | ok |
| electron:smoke | ok |
| agentruntime:smoke | ok |
| claudecode:smoke | ok |
| workplaces:smoke | ok |
| output:smoke | ok |
| e2e:smoke | ok |

`npm test`：ALL 8 SMOKES PASSED，无回归。

### 遗留项与下一步

- scheduler 仍使用 mock Agent 执行（`executeSequential` / `executeParallel` 为 setTimeout 模拟）
- Claude Code CLI 已封装但未接入真实 Agent 执行
- Electron 前端为占位内容，未订阅 `agent.*` / `output.ready` 事件
- 下一步：可考虑接入真实 Claude Code CLI 替换 mock 执行（需 Phase 9 或更高）

---

## 2026-07-04 / Phase 7 / output 汇总与预览

### 本轮计划回放

- 聚合全部角色 workplace 产物到 `output/` 目录
- 生成 `manifest.json`（元信息清单）+ `report.md`（最终报告）
- messagebus 广播 `output.ready`（附 outputPath + manifestPath）
- scheduler 的 `output_ready` 从 mock 替换为真实文件写入
- 建立 `output:smoke`

### 执行记录

#### 代码新增/变更

- `src/agentruntime/output/manager.ts`：OutputManager
  - `generateOutput(runId, wm)`：聚合 5 角色 result.md → 写入 manifest.json + report.md
  - `readOutput()`：反序列化 manifest.json
  - `OutputManifest` 结构：runId / createdAt / roles 元信息 / files 清单
- `src/agentruntime/output/index.ts`：barrel export
- `src/agentruntime/output/smoke.ts`：6 项检查
- `src/agentruntime/messagebus/client.ts`：新增 `publishOutputReady(outputPath, manifestPath, runId)`，广播 `OutputReadyPayload`
- `src/agentruntime/scheduler.ts`：
  - 导入 `createWorkplaceManager` / `createOutputManager`
  - 工厂函数内初始化 `wm` / `om` 实例
  - `output_ready` 阶段：`wm.initAll()` → `om.generateOutput()` → `busClient.publishOutputReady()`
- `package.json`：新增 `output:smoke`

#### 测试

- `npm run typecheck`：通过
- `npm run output:smoke`：6/6 通过
  - manifest.json 结构校验（runId / roles / files）
  - report.md 含 5 个角色章节
  - output 目录精确 2 文件
  - readOutput 往返一致性
- `npm run agentruntime:smoke`：通过（scheduler 集成无回归）

#### 文档

- `DEV_PROGRESS.md`：Phase 7 计划
- `LOG.md`：本轮记录
- `HANDOFF.md`：接力更新
- `dos/carvis/docs/progress/layers/07-output.md`：层级文档

### Git 状态

- 基线提交：`6319ef2`
- 备份分支：`backup/pre-phase7-output-20260704-1720`（已 push）

---

## 2026-07-04 / Phase 6 / workplaces 隔间

### 本轮计划回放

- 为 manager/writer/artist/researcher/engineer 各建独立 workplace 目录
- 固定 `input.md` / `plan.md` / `log.md` / `result.md` 文件结构
- 强制角色写隔离：每个角色只能写自身 workplace
- 工程师 Agent 可读所有前置角色 workplace
- 建立 `workplaces:smoke`

### 执行记录

#### 代码新增/变更

- `src/agentruntime/workplaces/manager.ts`：WorkplaceManager 核心实现
  - `initAll()` / `initRole()`：递归创建目录 + 默认文件
  - `writeFile()` / `appendFile()` / `readFile()` / `fileExists()`：文件 CRUD
  - `verifyPath(role, path)`：检查路径是否在角色 workplace 内
  - `getPriorRoles(role)`：基于 ROLE_FLOW 计算前置角色列表
  - `collectPriorResults(role)`：聚合所有前置角色 result.md
- `src/agentruntime/workplaces/index.ts`：barrel export
- `src/agentruntime/workplaces/smoke.ts`：smoke test（7 项检查）
- `package.json`：新增 `workplaces:smoke` 脚本

#### 测试

- `npm run typecheck`：通过
- `npm run workplaces:smoke`：7/7 通过
  - initAll 创建 5 角色 × 4 文件 = 20 个文件
  - 角色隔离验证：writer 无法写入 engineer 目录
  - 前置角色计算：engineer → [manager, writer, artist, researcher]
  - collectPriorResults 正确聚合 4 个角色结果

#### 文档

- `DEV_PROGRESS.md`：Phase 6 计划
- `LOG.md`：本轮记录
- `HANDOFF.md`：接力更新
- `dos/carvis/docs/progress/layers/06-workplaces.md`：层级文档

### Git 状态

- 施工前基线：`c108ad9`
- 备份分支：`backup/pre-phase6-workplaces-20260704-1700`（已 push）

---

## 2026-07-04 / Phase 5 / Claude Code CLI PID 封装

### 本轮计划回放

- 完成 `src/agentruntime/claudecode` Claude Code CLI PID 封装。
- 实现 CLI 子进程启动、角色 prompt/skills 注入、stdout/stderr/exit code 捕获。
- 支持保活和统一关闭。
- 建立 `claudecode:smoke`。

### 施工记录

- 创建 `src/agentruntime/claudecode/spawn.ts`：`spawnClaudeCode()` 封装 `child_process.spawn`，提供按行 stdout/stderr 捕获、exit code、timeout、kill 信号、stdin 写入。
- 创建 `src/agentruntime/claudecode/agent.ts`：`createClaudeCodeAgent()` 将 spawn 进程包装为 PID Agent，自动路由 stdout/stderr 到 messagebus，退出时发布 `agent.done` / `agent.error`。`defaultRolePrompts()` 提供 5 个角色的默认 systemPrompt + userPrompt。
- 创建 `src/agentruntime/claudecode/manager.ts`：`createAgentManager()` 管理 Agent 生命周期，支持启动指定角色 Agent 和统一 SIGTERM 关闭。
- 创建 `src/agentruntime/claudecode/index.ts`：barrel export。
- 更新 `src/agentruntime/claudecode/README.md`：架构图、模块说明、冒烟测试覆盖。
- 更新 `src/agentruntime/index.ts`：导出 claudecode 模块。

### 测试日志

- `npm run typecheck`：通过
- `npm run claudecode:smoke`：通过（7 项：stdout 捕获、stderr 捕获、非零 exit code、timeout、stdin 写入、kill 信号、token 检查）
- `npm run agentruntime:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过

### 失败/返工

- 无

### 文档漂移修正

- 更新 `src/agentruntime/claudecode/README.md`（新增架构、模块说明、smoke 覆盖）
- 更新 `src/agentruntime/index.ts`（新增 claudecode 导出）
- 更新 `dos/carvis/docs/DEV_PROGRESS.md`
- 更新 `dos/carvis/docs/LOG.md`
- 更新 `dos/carvis/docs/HANDOFF.md`
- 更新 `dos/carvis/docs/progress/layers/04-claudecode.md`

---

## 2026-07-04 / Phase 4 / agentruntime 调度核心

### 本轮计划回放

- 完成 `src/agentruntime` 调度核心最小状态机。
- 实现任务队列、PID Agent 池、心跳计时器、监督日志。
- 固定角色编排：总管 → 文书/美术/调研（并行）→ 技术。
- PID Agent done 后 retained，全部结束后统一 shutdown。
- 通过 messagebus 发布 `runtime.heartbeat`。
- 建立 `agentruntime:smoke`。

### 开工检查

- 已读取 `CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `docs/DEV_PROGRESS.md`
- 已读取 `docs/LOG.md`
- 已读取 `docs/GITHUB_ROLLBACK.md`
- 已读取 `docs/TEST_METRICS.md`
- 已读取 `docs/WORKFLOW.md`
- 已读取 `docs/CONSTRUCTION_PLAN.md`
- 已读取 `docs/ARCHITECTURE.md`
- 已读取 `docs/progress/layers/03-agentruntime.md`
- 已读取根目录 `对参考施工文档重构的要求 .txt`
- 当前分支：`main`
- 开发前基线提交：`2942a3bd90b298857004ab3ef236a45bdd3fc9c3`
- 开发前备份分支：`backup/pre-phase4-agentruntime-20260704-1615`
- 远端备份状态：已 push

### 本次修改

- 新增 `src/agentruntime/types.ts`：RuntimeConfig、TaskItem、PoolSnapshot、SchedulerState、ROLE_FLOW、状态转换校验。
- 新增 `src/agentruntime/pool.ts`：AgentPool（创建、状态追踪、snapshot、统一 shutdown）。
- 新增 `src/agentruntime/scheduler.ts`：TaskScheduler（RunPhase 状态机，驱动角色编排流程）。
- 新增 `src/agentruntime/heartbeat.ts`：HeartbeatTimer（周期性发布 runtime.heartbeat）。
- 新增 `src/agentruntime/messagebus/client.ts`：RuntimeBusClient（订阅命令、发布心跳/agent 事件/output）。
- 新增 `src/agentruntime/index.ts`：公开导出。
- 新增 `src/agentruntime/README.md`：职责边界文档。
- 新增 `src/agentruntime/smoke.ts`：覆盖角色流程、并发推进、shutdown 验证、心跳验证。
- `package.json` 新增 `agentruntime:smoke` 脚本。

### 修改文件

- `package.json`
- `src/agentruntime/types.ts`
- `src/agentruntime/pool.ts`
- `src/agentruntime/scheduler.ts`
- `src/agentruntime/heartbeat.ts`
- `src/agentruntime/messagebus/client.ts`
- `src/agentruntime/index.ts`
- `src/agentruntime/README.md`
- `src/agentruntime/smoke.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`

### 验证结果

- `npm run typecheck`：通过
- `npm run agentruntime:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过
- `npm run electron:smoke`：通过

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run agentruntime:smoke`，失败，心跳因同步执行未触发（heartbeat 间隔 50ms，advance 同步完成）
- 失败修复：在 heartbeat 断言前增加 `await setTimeout(100)` 等待心跳积累
- 第 2 次：`npm run agentruntime:smoke`，通过，输出 `[agentruntime:smoke] ok`
- 第 1 次：`npm run setup:smoke`，通过
- 第 1 次：`npm run messagebus:smoke`，通过
- 第 1 次：`npm run electron:smoke`，通过

### 测试指标判断

- 本轮涉及层：`03-agentruntime`、`02-messagebus`（runtime client）、`shared types`
- 应执行测试：`npm run typecheck`、`npm run agentruntime:smoke`
- 实际执行测试：`npm run typecheck`、`npm run agentruntime:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke`、`npm run electron:smoke`
- 未执行项及原因：`npm test` 尚未建立；真实 Claude Code CLI 尚未接入（属 Phase 5）

### 文档漂移检查

- `CONSTRUCTION_PLAN.md` 的 Phase 4 目标与实际实现一致：状态机、PID 池、心跳、角色编排均已覆盖。
- `TEST_METRICS.md` 的 Phase 4 最低测试（typecheck + agentruntime:smoke）已满足。
- `CODEX_MASTER_REQUIREMENTS.md` 的 agentruntime 边界未被突破：调度、心跳、角色编排均在 runtime 内。
- `ARCHITECTURE.md` 的角色编排顺序与实际 ROLE_FLOW 一致。
- 无需修改架构边界文档。

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase4-agentruntime-20260704-1615`
- 本轮提交：收尾回写提交
- push 状态：收尾回写提交后 push 到 `main`

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <phase4-commit>`
- 回滚后复测：`npm run typecheck`、`npm run agentruntime:smoke`

### 下一步

- Phase 5：Claude Code CLI PID 封装，接入真实 DeepSeek 端点，建立 `claudecode:smoke`。

## 2026-07-01 / Phase 3 / Electron 可视化外壳

### 本轮计划回放

- 完成 `src/electron` 可视化外壳的最小可运行版本。
- 建立五个 workplace 面板状态模型：manager、writer、artist、researcher、engineer。
- Electron mock shell 通过 messagebus 发布 `command.submitted`，订阅 `runtime.heartbeat` 和 `output.ready`。
- 建立 `electron:smoke`。

### 开工检查

- 已读取 `CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `docs/DEV_PROGRESS.md`
- 已读取 `docs/LOG.md`
- 已读取 `docs/GITHUB_ROLLBACK.md`
- 已读取 `docs/TEST_METRICS.md`
- 已读取 `docs/WORKFLOW.md`
- 已读取 `docs/CONSTRUCTION_PLAN.md`
- 已读取 `docs/progress/layers/01-electron.md`
- 已读取 `docs/progress/layers/02-messagebus.md`
- 已读取根目录 `对参考施工文档重构的要求 .txt`
- 当前分支：`main`
- 开发前基线提交：`a0f5a06aa78e286fab13de0047ccdea8ebc37b4f`
- 开发前计划提交：`ecd880e`
- 开发前备份分支：`backup/pre-phase3-electron-20260701-2343`
- 远端备份状态：已 push

### 本次修改

- 新增 Electron README，固定当前职责、边界和 smoke 覆盖范围。
- 新增 Electron shell 状态模型，包含五个 workplace 面板、runtime 心跳展示、output 入口、最近事件和已提交命令。
- 新增 Electron mock shell，订阅 `runtime.heartbeat`、`output.ready`、`agent.output`，提交命令时发布 `command.submitted`。
- 新增 `electron:smoke`，验证五个隔间、命令提交、心跳展示和 output 展示。
- `package.json` 新增 `electron:smoke` 脚本。

### 修改文件

- `package.json`
- `src/electron/README.md`
- `src/electron/types.ts`
- `src/electron/shell.ts`
- `src/electron/index.ts`
- `src/electron/smoke.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/01-electron.md`

### 验证结果

- `npm run typecheck`：通过
- `npm run electron:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过
- `sshpass ... ssh howtion@192.168.137.59 'hostname; uname -a; node --version; npm --version; git --version'`：通过，远端为 NixOS，Node `v22.22.2`，npm `10.9.7`，git `2.51.2`
- 远端 WiFi：已连接 `kyle`，`wlan0` 地址 `192.168.135.250`，默认出网路由走 WiFi；有线 `enp1s0` 保留用于 SSH
- `rsync` 同步到远端 `~/carvis-remote-smoke` 并执行远端 smoke：通过，远端干净 `npm ci --ignore-scripts --no-audit --no-fund` 后，`npm run typecheck`、`npm run electron:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke` 均通过

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run electron:smoke`，通过，输出 `[electron:smoke] ok`
- 第 1 次：`npm run messagebus:smoke`，通过，输出 `[messagebus:smoke] ok`
- 第 1 次：`npm run setup:smoke`，通过，输出 `[setup:smoke] ok`
- 第 1 次远程 SSH 调试：免密认证失败，用户提供密码后连接成功，确认远端 NixOS、Node、npm、git 可用
- 第 1 次远端同步 smoke：失败，目标机重启前连接中断，未完成 `rsync` 和远端 smoke
- 第 2 次远端同步 smoke：目标机重启后连通，远端 `npm install` 卡住；终止后发现 `tsc` 命令缺失
- 失败修复：同步本地 `node_modules` 到远端 `~/carvis-remote-smoke/node_modules`
- 第 3 次远端同步 smoke：通过，远端输出 `[electron:smoke] ok`、`[messagebus:smoke] ok`、`[setup:smoke] ok`
- WiFi 调试：远端连接 `kyle`，调整 `kyle` route metric 为 `50`，确认 `ip route get 8.8.8.8` 走 `wlan0`
- npm 复测：远端 `/tmp/carvis-npm-check` 干净 `npm ci --ignore-scripts --no-audit --no-fund` 通过
- 第 4 次远端同步 smoke：远端 `~/carvis-remote-smoke` 删除 `node_modules` 和 `dist` 后干净 `npm ci`，随后 `typecheck`、`electron:smoke`、`messagebus:smoke`、`setup:smoke` 全部通过

### 测试指标判断

- 本轮涉及层：`01-electron`、`02-messagebus`
- 应执行测试：`npm run typecheck`、`npm run electron:smoke`
- 实际执行测试：`npm run typecheck`、`npm run electron:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke`
- 未执行项及原因：`npm test` 尚未建立；真实 Electron 窗口尚未建立，当前 Phase 3 使用 TypeScript mock shell 验证协议和状态

### 文档漂移检查

- `CONSTRUCTION_PLAN.md` 的 Phase 3 目标与当前 mock shell 实现一致，真实窗口、响应式 UI 和 output 打开能力仍属于后续增量。
- `TEST_METRICS.md` 的 Phase 3 最低测试已满足：`npm run typecheck` 和 `npm run electron:smoke`。
- `CODEX_MASTER_REQUIREMENTS.md` 的 Electron 边界未被突破。
- 无需修改架构边界文档。

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase3-electron-20260701-2343`
- 本轮主体提交：`d535c3f`
- 最终记录提交：本次收尾回写提交
- push 状态：收尾回写提交后 push 到 `main`

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <phase3-commit>`
- 回滚后复测：`npm run typecheck`、`npm run electron:smoke`、`npm run messagebus:smoke`

### 下一步

- Phase 4：实现 agentruntime 调度核心的最小状态机和 heartbeat 发布。

## 2026-07-01 / Phase 2 / messagebus 事件协议

### 本轮计划回放

- 完成 `src/messagebus` 本地事件协议第一版。
- 建立 mock Electron 到 mock agentruntime 的 `command.submitted` 转发验证。
- 建立 mock agentruntime 到 mock Electron 的 `runtime.heartbeat` 广播验证。
- 保持 messagebus 只负责 envelope、订阅、发布和转发，不执行任务、不读写 workplace。

### 开工检查

- 已读取 `CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `docs/DEV_PROGRESS.md`
- 已读取 `docs/LOG.md`
- 已读取 `docs/GITHUB_ROLLBACK.md`
- 已读取 `docs/TEST_METRICS.md`
- 已读取 `docs/WORKFLOW.md`
- 已读取 `docs/CONSTRUCTION_PLAN.md`
- 已读取 `docs/progress/layers/02-messagebus.md`
- 已读取根目录 `对参考施工文档重构的要求 .txt`
- 当前分支：`main`
- 开发前计划提交：`edd6e14`
- 开发前备份分支：`backup/pre-phase2-messagebus-20260701-2145`
- 远端备份状态：已 push

### 本次修改

- 新增 messagebus README，固定职责和禁止事项。
- 新增内存版 messagebus，支持订阅、发布、按 `type/source/target` 过滤投递。
- 新增 envelope 自动补齐能力，生成 `eventId` 和 `timestamp`。
- 新增 command、heartbeat、agent output、output ready 的共享 payload 类型。
- 新增 `messagebus:smoke`，验证命令转发、heartbeat 广播和无订阅投递计数。
- `package.json` 新增 `messagebus:smoke` 脚本。

### 修改文件

- `package.json`
- `src/shared/types/events.ts`
- `src/messagebus/README.md`
- `src/messagebus/types.ts`
- `src/messagebus/bus.ts`
- `src/messagebus/index.ts`
- `src/messagebus/smoke.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`

### 验证结果

- `npm run typecheck`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run messagebus:smoke`，通过，输出 `[messagebus:smoke] ok`
- 第 1 次：`npm run setup:smoke`，通过，输出 `[setup:smoke] ok`
- 失败修复：无，测试未失败

### 测试指标判断

- 本轮涉及层：`02-messagebus`、`shared types`
- 应执行测试：`npm run typecheck`、`npm run messagebus:smoke`
- 实际执行测试：`npm run typecheck`、`npm run messagebus:smoke`、`npm run setup:smoke`
- 未执行项及原因：`npm test` 尚未建立，当前 Phase 2 只要求 messagebus smoke

### 文档漂移检查

- `CONSTRUCTION_PLAN.md` 的 Phase 2 目标与实际实现一致。
- `TEST_METRICS.md` 的 Phase 2 指标与实际测试一致。
- `CODEX_MASTER_REQUIREMENTS.md` 的 messagebus 边界未被突破。
- 无需修改架构边界文档。

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase2-messagebus-20260701-2145`
- 本轮主体提交：`8b8b0c0`
- 最终记录提交：`e4debfb`
- push 状态：已 push 到 `main`

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <phase2-commit>`
- 回滚后复测：`npm run typecheck`、`npm run messagebus:smoke`

### 下一步

- Phase 3：实现 Electron 可视化外壳的最小可运行版本。
- 在 Electron 输入框回车时发布 `command.submitted`。
- Electron 订阅 `runtime.heartbeat` 并显示运行时状态。

## 2026-07-01 / Phase 1 / setup 启动协议

### 本轮计划回放

- 完成 `src/setup` 第一版 TypeScript 启动协议。
- setup 按顺序模拟拉起 `messagebus`、`agentruntime`、`electron`。
- 建立 `setup:smoke`，验证启动顺序和失败短路。
- 保持 setup 只负责启动协议，不触碰 Agent 业务、workplace 或 Claude Code CLI。

### 开工检查

- 已读取 `CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `docs/DEV_PROGRESS.md`
- 已读取 `docs/LOG.md`
- 已读取 `docs/GITHUB_ROLLBACK.md`
- 已读取 `docs/TEST_METRICS.md`
- 已读取 `docs/WORKFLOW.md`
- 已读取 `docs/progress/layers/00-setup.md`
- 当前分支：`main`
- 开发前计划提交：`bf86ab8`
- 开发前备份分支：`backup/pre-phase1-setup-20260701-203615`
- 远端备份状态：已 push

### 本次修改

- 新增 setup 类型定义。
- 新增 setup 配置加载。
- 新增 setup supervisor，支持 `plan` 和 `spawn` 两种模式。
- 新增可注入的 `ComponentStarter`，让启动协议和测试解耦。
- 新增 `setup:smoke`，断言成功启动顺序和 required 组件失败短路。
- `bootstrap` 接入 setup plan 模式，默认只模拟启动顺序，不真实拉起 Electron 或 Agent。
- `package.json` 新增 `setup:smoke` 脚本。

### 修改文件

- `package.json`
- `src/bootstrap.ts`
- `src/setup/README.md`
- `src/setup/config.ts`
- `src/setup/index.ts`
- `src/setup/smoke.ts`
- `src/setup/supervisor.ts`
- `src/setup/types.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/00-setup.md`

### 验证结果

- `npm run typecheck`：通过
- `npm run setup:smoke`：通过
- `npm start`：通过

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run setup:smoke`，通过，输出 `[setup:smoke] ok`
- 第 1 次：`npm start`，通过，输出启动顺序 `messagebus -> agentruntime -> electron`
- 失败修复：无，测试未失败

### 测试指标判断

- 本轮涉及层：`00-setup`
- 应执行测试：`npm run typecheck`、`npm run setup:smoke`
- 实际执行测试：`npm run typecheck`、`npm run setup:smoke`、`npm start`
- 未执行项及原因：`npm test` 尚未建立，当前 Phase 1 只要求 setup smoke

### 文档漂移检查

- `CONSTRUCTION_PLAN.md` 的 Phase 1 目标与实际实现一致。
- `TEST_METRICS.md` 的 Phase 1 指标与实际测试一致。
- `CODEX_MASTER_REQUIREMENTS.md` 的 setup 边界未被突破。
- 无需修改架构边界文档。

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase1-setup-20260701-203615`
- 本轮主体提交：`2e9e925`
- 最终记录提交：`0bc9da5`
- push 状态：已 push 到 `main`
- 最新远端 HEAD 以 GitHub `main` 为准

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <phase1-commit>`
- 回滚后复测：`npm run typecheck`、`npm run setup:smoke`

### 下一步

- Phase 2：实现 messagebus 事件协议和 `messagebus:smoke`
- 保持 Electron 和 agentruntime 通过 messagebus 解耦

## 2026-07-01 / Phase 0 / 迁移施工文档脚手架

### 目标

按照根目录 `对参考施工文档重构的要求 .txt`，基于 `dos/catnip` 的施工文档模式，为 `carvis` 迁移一套新的施工文档脚手架。

### 开工检查

- 已读取 `对参考施工文档重构的要求 .txt`
- 已读取 `dos/catnip/CODEX_START_HERE.md`
- 已读取 `dos/catnip/CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `dos/catnip/docs/CONSTRUCTION_PLAN.md`
- 已读取 `dos/catnip/docs/ARCHITECTURE.md`
- 已读取 `dos/catnip/docs/DEV_PROGRESS.md`
- 已读取 `dos/catnip/docs/LOG.md`
- 已检查当前 `src` 目录层次
- 已确认 `参考施工文档` 目录为空
- 已初始化本地 Git 仓库
- 已绑定远端仓库：`git@github.com:howtion0/carvis.git`
- 开发前基线提交：`868b31da3dd59f40f895cf19b98b0158b9b65ba8`
- 开发前备份分支：`backup/pre-carvis-bootstrap-20260701-203039`
- 远端备份状态：已 push
- 本轮施工主体提交：`eb657c7`

### 本次修改

- 新建 `dos/carvis` 文档脚手架
- 新建 Carvis 主入口文档
- 新建 Carvis 总需求与施工主指令
- 新建架构、施工计划、进度、日志、分层约束文档
- 新建 GitHub 备份与回滚机制文档
- 新建测试指标与验收要求文档
- 新建施工工作流文档，固定开工先写计划、收尾先写日志
- 新建接力文档规范
- 将施工闭环固化为：计划 -> GitHub 备份 -> 施工 -> 施工记录 -> 测试日志 -> 失败返工复测 -> 文档漂移修正 -> 接力文档 -> 上传 GitHub
- 新建分层进度日志
- 新建 TypeScript 工程骨架
- 新建 Claude Code CLI 的 DeepSeek 官方环境变量适配模块

### 改动部分

- 文档：`dos/carvis`
- TypeScript 工程：`package.json`、`tsconfig.json`、`src/main.ts`、`src/bootstrap.ts`
- 共享类型：`src/shared/types`
- Claude Code 适配：`src/agentruntime/claudecode`
- 未修改 `dos/catnip` 参考项目

### 验证结果

- 文档文件已创建
- 已新增 TypeScript 工程骨架
- `npm install`：通过
- `npm run typecheck`：通过
- GitHub SSH：通过，账号 `howtion0`
- GitHub 开发前备份分支 push：通过

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 2 次：`npm run typecheck`，通过
- 失败修复：无，测试未失败

### GitHub 状态

- 当前分支：`main`
- 远端仓库：`git@github.com:howtion0/carvis.git`
- 开发前基线提交：`868b31da3dd59f40f895cf19b98b0158b9b65ba8`
- 开发前备份分支：`backup/pre-carvis-bootstrap-20260701-203039`
- 本轮施工主体提交：`eb657c7`
- push 状态：已 push 到 `main`
- 最新远端 HEAD 以 GitHub `main` 为准

### 测试指标判断

- 本轮涉及层：文档、TypeScript 基础骨架、Claude Code 环境适配文档
- 应执行测试：`npm run typecheck`
- 实际执行测试：`npm run typecheck`
- 未执行项及原因：子系统 smoke test 尚未建立，当前 Phase 只建立施工文档和基础骨架

### 回滚判断

- 当前已初始化 Git 仓库并绑定 GitHub remote
- 本轮具备 GitHub 开发前备份点：`backup/pre-carvis-bootstrap-20260701-203039`
- 如需回滚文档迁移，可删除 `dos/carvis`
- 如需回滚本轮误建代码骨架，可删除 `package.json`、`package-lock.json`、`tsconfig.json`、`.gitignore`、`node_modules`、`src/main.ts`、`src/bootstrap.ts`、`src/shared/types`、`src/agentruntime/claudecode/README.md`、`src/agentruntime/claudecode/deepseekClaudeCodeEnv.ts`
- 如本轮提交已进入 GitHub，可优先使用 `git revert <commit>` 回滚

### 下一步

- 补 `src/*/README.md`
- 补最小 TypeScript 类型和 messagebus smoke test
