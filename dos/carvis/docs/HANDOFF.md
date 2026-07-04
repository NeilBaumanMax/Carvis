# Carvis Handoff Document

## 目标

本文件用于每轮施工结束后，把下一位 Codex 或下一次开机继续施工所需的信息写清楚。

每次测试通过并完成文档漂移修正后，必须更新本文件。没有更新接力文档，不允许把本轮施工标记为完整完成。

## 每轮必须更新的内容

```text
## <date> / <phase> / 接力记录

### 当前状态

- <what works now>

### 本轮完成

- <completed item>

### 未完成

- <pending item>

### 下次优先任务

1. <next task>
2. <next task>

### 必读文档

- <doc path>

### 关键文件

- <file path>

### 测试基线

- `<command>`：通过

### GitHub 状态

- 当前分支：<branch>
- 最新提交：<commit>
- 已 push：是 / 否
- 备份分支：<backup branch>

### 风险提醒

- <risk>
```

## 接力质量要求

- 必须让下一次开机不靠聊天记录也能继续。
- 必须写清楚下次先做什么，不只写泛泛的“继续开发”。
- 必须写清楚哪些测试已经通过。
- 必须写清楚哪些脚本或能力还没有建立。
- 必须写清楚 GitHub 是否已经上传。

## 2026-07-04 / Phase 7 / 接力记录

### 当前状态

- Phase 7 output 汇总与预览已完成。
- `src/agentruntime/output/manager.ts` 提供 OutputManager：
  - `generateOutput(runId, wm)` 聚合全部角色 result.md → 写 `manifest.json` + `report.md`
  - `readOutput()` 反序列化 manifest
- `src/agentruntime/messagebus/client.ts` 新增 `publishOutputReady(outputPath, manifestPath, runId)`，广播 `OutputReadyPayload`
- scheduler 的 `output_ready` 阶段已从 mock 替换为真实文件生成：`wm.initAll()` → `om.generateOutput()` → `busClient.publishOutputReady()`

### 本轮完成

- 新增 `src/agentruntime/output/manager.ts`、`index.ts`、`smoke.ts`
- 修改 `src/agentruntime/messagebus/client.ts`、`src/agentruntime/scheduler.ts`、`package.json`
- `package.json` 新增 `output:smoke` 脚本
- smoke 6/6 通过 + agentruntime:smoke 无回归

### 未完成

- scheduler 仍使用 mock Agent 执行，尚未接入真实 Claude Code CLI 子进程。
- Electron 端尚未订阅 `output.ready` 事件并渲染产物预览。

### 下次优先任务

1. Phase 8：集成验收 — 串联完整链路（用户命令 → 5 角色执行 → output 产物），建 `e2e:smoke`。
2. 将 scheduler mock Agent 执行替换为真实 `createClaudeCodeAgent`。
3. Electron 端订阅 `output.ready` 事件并渲染 `report.md` 预览。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/07-output.md`

### 关键文件

- `src/agentruntime/output/manager.ts`（OutputManager 核心）
- `src/agentruntime/scheduler.ts`（已集成 OutputManager）
- `src/agentruntime/messagebus/client.ts`（已集成 publishOutputReady）
- `src/agentruntime/workplaces/manager.ts`（WorkplaceManager，被 OutputManager 消费）
- `package.json`

### 测试基线

- `npm run typecheck`：通过
- `npm run output:smoke`：通过（6/6）
- `npm run workplaces:smoke`：通过
- `npm run agentruntime:smoke`：通过
- `npm run claudecode:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过

### GitHub 状态

- 基线提交：`6319ef2`
- 备份分支：`backup/pre-phase7-output-20260704-1720`
- push 状态：收尾回写提交后 push 到 `main`

### 风险提醒

- scheduler 仍为 mock Agent 执行，Phase 8 必须接入真实 CLI。
- `output/` 目录每次运行会覆盖，未做历史归档。
- Electron 端 `output.ready` 事件订阅尚未实现，前端无法展示产物。

---

## 2026-07-04 / Phase 6 / 接力记录

### 当前状态

- Phase 6 workplaces 隔间已完成。
- `src/agentruntime/workplaces/manager.ts` 提供完整的 WorkplaceManager：
  - `initAll()` / `initRole()` 为 5 个角色创建独立目录和 4 个固定文件（input/plan/log/result.md）
  - `writeFile()` / `appendFile()` / `readFile()` / `fileExists()` 文件 CRUD
  - `verifyPath(role, path)` 角色写隔离校验
  - `getPriorRoles(role)` 基于 ROLE_FLOW 计算前置角色列表（engineer 得到 manager+writer+artist+researcher）
  - `collectPriorResults(role)` 聚合所有前置角色 result.md

### 本轮完成

- 新增 `src/agentruntime/workplaces/manager.ts`、`index.ts`、`smoke.ts`。
- `package.json` 新增 `workplaces:smoke` 脚本。
- smoke 7/7 通过：20 个文件创建、角色隔离验证、前置角色计算、结果聚合。

### 未完成

- scheduler 仍使用 mock Agent 执行，尚未接入真实 Claude Code CLI 子进程。
- WorkplaceManager 尚未接入 scheduler 在执行前调用 `initAll()`。
- agentruntime 侧 MCP 桥接。

### 下次优先任务

1. Phase 7：output 汇总与预览 — 技术 Agent 汇总生成最终产物到 `output/`，messagebus 广播 `output.ready`，Electron 预览产物。
2. 在 scheduler 集成 WorkplaceManager，执行前 `initAll()`。
3. 将 scheduler 的 mock 执行替换为真实 `createClaudeCodeAgent`。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/06-workplaces.md`

### 关键文件

- `src/agentruntime/workplaces/manager.ts`（WorkplaceManager 核心）
- `src/agentruntime/workplaces/smoke.ts`（7 项冒烟测试）
- `src/agentruntime/scheduler.ts`（调度核心，需集成 WorkplaceManager）
- `src/agentruntime/pool.ts`（AgentPool，已有 workplacePath）
- `package.json`

### 测试基线

- `npm run typecheck`：通过
- `npm run workplaces:smoke`：通过
- `npm run claudecode:smoke`：通过
- `npm run agentruntime:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过

### GitHub 状态

- 当前分支：`main`
- 基线提交：`c108ad9`
- 备份分支：`backup/pre-phase6-workplaces-20260704-1700`
- push 状态：收尾回写提交后 push 到 `main`

### 风险提醒

- scheduler 仍为 mock 执行，Phase 7 需要将 mock 替换为真实 CLI 子进程。
- WorkplaceManager 使用 `ROLE_FLOW` 推算前置角色，若 ROLE_FLOW 结构变化需同步维护 `getPriorRoles()`。
- 角色隔离在 WorkplaceManager 层校验，scheduler 集成时需要确保 Agent 通过 WorkplaceManager 做 I/O，不能直接 `fs.writeFile()` 绕过。

---

## 2026-07-04 / Phase 5 / 接力记录

### 当前状态

- Phase 5 Claude Code CLI PID 封装已完成。
- `src/agentruntime/claudecode` 现在有 spawn（子进程封装）、agent（PID Agent 包装）、manager（生命周期管理）、smoke（7 项测试）。
- `spawnClaudeCode()` 支持按行 stdout/stderr 捕获、exit code、timeout、kill 信号、stdin 写入。
- `createClaudeCodeAgent()` 自动路由 I/O 到 messagebus，退出时发布 `agent.done` / `agent.error`。
- `createAgentManager()` 支持启动角色 Agent 和统一 SIGTERM 关闭。

### 本轮完成

- 新增 `src/agentruntime/claudecode/spawn.ts`、`agent.ts`、`manager.ts`、`index.ts`、`smoke.ts`。
- 更新 `src/agentruntime/claudecode/README.md`、`src/agentruntime/index.ts`、`package.json`。
- `package.json` 新增 `claudecode:smoke` 脚本。
- 所有 smoke（typecheck / claudecode / agentruntime / messagebus / setup）均通过。

### 未完成

- scheduler 仍使用 mock Agent 执行，尚未接入真实 Claude Code CLI 子进程。
- workplaces 物理目录管理（Phase 6）。
- agentruntime 侧 MCP 桥接。

### 下次优先任务

1. Phase 6：workplaces 隔间 — 为每个角色建立独立 workplace 目录，固定 input/plan/log/result 文件结构。
2. 让 agentruntime 在角色分配时自动创建 workplace。
3. 限制每个角色只能写自身 workplace，engineer 可读所有前置 workplace。
4. 建立 `workplaces:smoke`。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/04-claudecode.md`

### 关键文件

- `src/agentruntime/claudecode/spawn.ts`（子进程启动核心）
- `src/agentruntime/claudecode/agent.ts`（PID Agent 封装）
- `src/agentruntime/claudecode/manager.ts`（生命周期管理）
- `src/agentruntime/claudecode/smoke.ts`（7 项冒烟测试）
- `src/agentruntime/claudecode/deepseekClaudeCodeEnv.ts`（环境变量适配）
- `src/agentruntime/scheduler.ts`（调度核心，仍为 mock 执行）
- `package.json`

### 测试基线

- `npm run typecheck`：通过
- `npm run claudecode:smoke`：通过
- `npm run agentruntime:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过

### GitHub 状态

- 当前分支：`main`
- 基线提交：`32bf89c2`
- 备份分支：`backup/pre-phase5-claudecode-20260704-1645`
- push 状态：收尾回写提交后 push 到 `main`

### 风险提醒

- 当前 scheduler 的 Agent 执行仍是 mock 的，Phase 6/7 需要将 `executeSequential`/`executeParallel` 中的 mock 调用替换为真实的 `createClaudeCodeAgent` 调用。
- `ANTHROPIC_AUTH_TOKEN` 必须通过环境变量注入，不能写入仓库。
- 缺少 token 时 `isClaudeCodeAvailable()` 返回 false，scheduler 集成时应检查此状态并给出配置错误提示。
- smoke 测试使用 `echo`/`node -e` 作为 mock 命令，不依赖真实 `claude` CLI 存在。

## 2026-07-04 / Phase 4 / 接力记录

### 当前状态

- Phase 4 agentruntime 调度核心已完成。
- `src/agentruntime` 现在有完整的类型定义、AgentPool、TaskScheduler、HeartbeatTimer、RuntimeBusClient。
- 角色编排流程：总管先启动 → 文书/美术/调研并行 → 技术等待前置完成后启动。
- PID Agent 生命周期：idle → starting → ready → assigned → working → done → retained → shutdown。
- HeartbeatTimer 周期性发布 `runtime.heartbeat` 到 Electron。
- RuntimeBusClient 封装了 agentruntime 侧的所有消息总线操作。

### 本轮完成

- 新增 `src/agentruntime/types.ts`、`pool.ts`、`scheduler.ts`、`heartbeat.ts`、`messagebus/client.ts`、`index.ts`、`README.md`、`smoke.ts`。
- `package.json` 新增 `agentruntime:smoke` 脚本。
- 所有现有 smoke（setup / messagebus / electron / agentruntime）均通过。

### 未完成

- 真实 Claude Code CLI PID 启动（Phase 5）
- `src/agentruntime/claudecode` 子层只有环境变量适配，无真实进程封装
- agentruntime 侧 MCP 桥接（预留目录，无代码）
- workplaces 物理目录管理（Phase 6）

### 下次优先任务

1. Phase 5：实现 `src/agentruntime/claudecode` 的 Claude Code CLI PID 封装。
2. 封装 CLI 进程启动、角色 prompt/skills 注入、stdout/stderr 捕获、exit code 处理。
3. 将 mock Agent 执行替换为真实 CLI 子进程调用。
4. 建立 `claudecode:smoke`（验证启停、I/O 捕获、token 缺失报错）。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`
- `dos/carvis/docs/progress/layers/04-claudecode.md`

### 关键文件

- `src/agentruntime/scheduler.ts`（调度状态机核心）
- `src/agentruntime/pool.ts`（Agent 池管理）
- `src/agentruntime/heartbeat.ts`（心跳计时器）
- `src/agentruntime/messagebus/client.ts`（runtime 侧消息适配）
- `src/agentruntime/claudecode/deepseekClaudeCodeEnv.ts`（已有环境变量适配）
- `package.json`

### 测试基线

- `npm run typecheck`：通过
- `npm run agentruntime:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过
- `npm run electron:smoke`：通过

### GitHub 状态

- 当前分支：`main`
- 开发前基线提交：`2942a3bd90b298857004ab3ef236a45bdd3fc9c3`
- 开发前备份分支：`backup/pre-phase4-agentruntime-20260704-1615`
- 本轮主体提交：收尾回写提交
- push 状态：收尾回写提交后 push 到 `main`

### 风险提醒

- 当前 agentruntime 的 Agent 执行是 mock 的（无真实子进程），Phase 5 需要将 scheduler 中的 mock 调用替换为真实 CLI 子进程。
- heartbeat 默认间隔 1 秒，生产环境可能需调整 `CARVIS_HEARTBEAT_MS`。
- scheduler 的 `advance()` 目前是手动推进，后续需改为事件驱动自动推进。
- 不要让 electron 绕过 messagebus 直接调度 agentruntime。

## 2026-07-01 / Phase 3 / 接力记录

### 当前状态

- Phase 3 Electron mock shell 已实现。
- `src/electron` 现在有 README、状态类型、shell、入口和 smoke test。
- Electron mock shell 默认展示 manager、writer、artist、researcher、engineer 五个 workplace 面板。
- Electron mock shell 可通过 messagebus 发布 `command.submitted`，并订阅 `runtime.heartbeat` 和 `output.ready` 更新展示状态。

### 本轮完成

- 新增 `electron:smoke`。
- 输入命令会 trim 后发送到 `agentruntime`。
- heartbeat 可更新 active/idle/retained PID 数量和 queueDepth。
- output ready 可生成可展示的 output entry。
- 已用密码 SSH 连接 `howtion@192.168.137.59`，确认远端是 NixOS，Node `v22.22.2`、npm `10.9.7`、git `2.51.2` 可用。
- 已连接远端 WiFi `kyle`，`wlan0` 地址 `192.168.135.250`，默认出网路由走 WiFi；有线 `192.168.137.59` 保留用于 SSH。
- 已同步当前工作区到远端 `~/carvis-remote-smoke`，干净 `npm ci` 后通过远端 smoke。

### 未完成

- 真实 Electron 窗口和 renderer UI 尚未实现。
- 桌面与窄窗口下的视觉重叠和文字溢出检查尚未建立。
- output 真实打开能力尚未实现。
- agentruntime 侧 messagebus client 尚未实现。

### 下次优先任务

1. Phase 4：实现 agentruntime 调度核心最小状态机。
2. 让 agentruntime 发布真实 `runtime.heartbeat` 到 messagebus。
3. 后续真实 Electron 窗口建立后做桌面与窄窗口视觉验收。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/01-electron.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`

### 关键文件

- `src/electron/shell.ts`
- `src/electron/types.ts`
- `src/electron/smoke.ts`
- `src/messagebus/bus.ts`
- `src/shared/types/events.ts`
- `package.json`

### 测试基线

- `npm run typecheck`：通过
- `npm run electron:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过
- 远端 `~/carvis-remote-smoke` 中同一组命令：通过

### GitHub 状态

- 当前分支：`main`
- 开发前基线提交：`a0f5a06aa78e286fab13de0047ccdea8ebc37b4f`
- 开发前计划提交：`ecd880e`
- 开发前备份分支：`backup/pre-phase3-electron-20260701-2343`
- 本轮主体提交：`d535c3f`
- 最终记录提交：本次收尾回写提交
- 当前 push 状态：收尾回写提交后 push 到 `main`

### 风险提醒

- 当前 Electron 是 TypeScript mock shell，不是真实窗口。
- 不要让 Electron 绕过 messagebus 直接调用 agentruntime。
- 远端当前默认出网走 WiFi，SSH 仍通过有线地址 `192.168.137.59` 最稳定。

## 2026-07-01 / Phase 2 / 接力记录

### 当前状态

- Phase 2 messagebus 事件协议已实现。
- `src/messagebus` 现在有 README、类型、内存总线、入口和 smoke test。
- mock Electron 可通过 messagebus 向 mock agentruntime 发送 `command.submitted`。
- mock agentruntime 可通过 messagebus 向 mock Electron 广播 `runtime.heartbeat`。

### 本轮完成

- messagebus 支持 `publish`、`subscribe` 和 envelope 自动补齐。
- 订阅过滤支持 `type`、`source`、`target`。
- 共享事件类型补充 command、heartbeat、agent output、output ready payload。
- 新增 `messagebus:smoke`。

### 未完成

- 真实 IPC/WebSocket 传输尚未实现，当前是内存协议版本。
- 断连错误事件尚未实现，目前无订阅时返回 `delivered: 0`。
- agentruntime 侧 messagebus client 尚未实现。
- Electron 真实入口和 UI 尚未实现。

### 下次优先任务

1. Phase 3：实现 Electron 可视化外壳的最小可运行版本。
2. 为 `src/electron` 补 README。
3. 建立 `electron:smoke`，验证输入框回车或等价 mock 能发布 `command.submitted`。
4. 让 Electron mock 订阅 `runtime.heartbeat` 并展示运行时状态。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/01-electron.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`

### 关键文件

- `src/messagebus/bus.ts`
- `src/messagebus/types.ts`
- `src/messagebus/smoke.ts`
- `src/shared/types/events.ts`
- `package.json`

### 测试基线

- `npm run typecheck`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase2-messagebus-20260701-2145`
- 本轮主体提交：`8b8b0c0`
- 最终记录提交：`e4debfb`
- 当前 push 状态：已 push 到 `main`

### 风险提醒

- 当前 messagebus 是内存实现，不是跨进程传输；Phase 3 可以先用 mock/内存事件验证 UI 协议，后续再替换传输层。
- 不要让 Electron 绕过 messagebus 直接调用 agentruntime。

## 2026-07-01 / Phase 0 / 接力记录

### 当前状态

- `dos/carvis` 施工文档脚手架已建立。
- GitHub remote 已绑定到 `git@github.com:howtion0/carvis.git`。
- 开发前备份分支已 push：`backup/pre-carvis-bootstrap-20260701-203039`。
- GitHub SSH 已验证可用，账号为 `howtion0`。

### 本轮完成

- 固定 TypeScript、NixOS、Electron、messagebus、agentruntime、Claude Code CLI、DeepSeek 的施工边界。
- 固定 GitHub 备份、回滚、测试指标、施工闭环和接力文档规则。
- 建立基础 TypeScript 骨架和 DeepSeek Claude Code 环境变量适配。

### 未完成

- 还没有连接外部 NixOS 主机，缺少目标 IP 或 hostname。
- 子系统 smoke test 脚本尚未建立。
- Electron、messagebus、agentruntime 真实代码尚未实现。

### 下次优先任务

1. 获取 NixOS 目标机器 IP 或 hostname，验证 SSH 登录。
2. 为 `src/setup`、`src/messagebus`、`src/agentruntime`、`src/electron` 补 README。
3. 建立最小 smoke test 脚本。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/GITHUB_ROLLBACK.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`

### 关键文件

- `package.json`
- `tsconfig.json`
- `src/agentruntime/claudecode/deepseekClaudeCodeEnv.ts`
- `dos/carvis/docs/LOG.md`

### 测试基线

- `npm run typecheck`：通过

### GitHub 状态

- 当前分支：`main`
- 开发前基线提交：`868b31da3dd59f40f895cf19b98b0158b9b65ba8`
- 已 push 备份分支：是
- 备份分支：`backup/pre-carvis-bootstrap-20260701-203039`
- 当前施工主体提交：`eb657c7`
- 当前 push 状态：已 push 到 `main`
- 最新远端 HEAD 以 GitHub `main` 为准

### 风险提醒

- 当前本地环境显示为 Kali，不是 NixOS。
- 用户提供了 NixOS 用户名和密码，但还没有提供目标主机地址。

## 2026-07-01 / Phase 1 / 接力记录

### 当前状态

- Phase 1 setup 启动协议已实现。
- `src/setup` 现在有类型、配置、supervisor、smoke test 和 README。
- 默认 `npm start` 使用 `plan` 模式，只模拟启动顺序，不真实拉起 Electron 或 Agent。

### 本轮完成

- setup 按顺序模拟启动 `messagebus -> agentruntime -> electron`。
- required 组件启动失败时，setup 会短路并返回 `setup.failed`。
- `setup:smoke` 覆盖成功顺序和失败短路。
- `npm run typecheck`、`npm run setup:smoke`、`npm start` 均通过。

### 未完成

- messagebus 真实事件协议尚未实现。
- Electron 真实入口尚未实现。
- agentruntime 真实入口尚未实现。
- setup 的 `spawn` 模式还没有接入真实长跑进程监督。

### 下次优先任务

1. Phase 2：实现 `src/messagebus` 事件协议。
2. 新增 `messagebus:smoke`。
3. 让 mock Electron 命令能通过 messagebus 到达 mock agentruntime。
4. 让 mock agentruntime heartbeat 能广播给 mock Electron。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`

### 关键文件

- `src/setup/supervisor.ts`
- `src/setup/config.ts`
- `src/setup/types.ts`
- `src/setup/smoke.ts`
- `package.json`

### 测试基线

- `npm run typecheck`：通过
- `npm run setup:smoke`：通过
- `npm start`：通过

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase1-setup-20260701-203615`
- 当前施工主体提交：`2e9e925`
- 最终记录提交：`0bc9da5`
- 当前 push 状态：已 push 到 `main`
- 最新远端 HEAD 以 GitHub `main` 为准

### 风险提醒

- `spawn` 模式尚未做长期进程监督。
- Phase 2 前不要让 Electron 或 agentruntime 绕过 messagebus 直接通信。
