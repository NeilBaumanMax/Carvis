# 03 AgentRuntime Progress

## 2026-07-03 / NixOS readback and drift fix / 开工计划

### 当前目标

- 以远端 NixOS 和当前 `runtime.ts` 为准，修正 agentruntime 文档漂移。
- 当前 production flow 是 `created -> parallel_roles_working -> engineer_building -> output_ready -> retaining_agents`。
- `manager_planning` / `manager_reviewing` 仍在类型和辅助代码中保留，用于历史记录和兼容 smoke，但不是当前常驻 production flow。

### 计划改动

- 更新本层当前状态、远端 systemd 状态和 provider worker 事实。
- 把旧的“manager 二次复审 gate”说明标成历史能力，不再写成当前生产流。
- 记录真实 provider worker 保留方式和 provider usage 写入。

### 验收指标

- 文档与 `src/agentruntime/runtime.ts` 当前执行顺序一致。
- 文档与远端 `carvis-agentruntime.service` active、5 个 provider worker PID active 的事实一致。
- `npm run typecheck` 和 `npm run build` 通过。

## 2026-07-02 / Real provider role routing / 开工计划

### 当前目标

- 常驻 `agentruntime/main.ts` 不再只用本地模板，应可切到真实 provider runner。
- manager/engineer 路由到 DeepSeek Claude Code。
- writer/artist/researcher 路由到 Qwen3.5-Omni-Plus OpenAI 兼容接口。
- 所有角色 prompt 注入本角色 `skill.md`、`plan.md` 和必要上游 workplace 内容。

### 计划改动

- 新增 multi-provider role runner。
- 新增 Qwen client。
- 保留现有模板 runner 作为无 key/dry fallback 和 smoke 路径。
- 让 manager review gate 消费真实员工产物。

### 验收指标

- 本地 smoke 能断言角色 provider 路由正确。
- NixOS systemd 常驻服务带本地 secret 后能执行真实 provider 调用。
- 产物不再出现与用户任务无关的固定“雾/记忆/老年旅人”模板。

### 本次完成

- `AgentRuntimeOptions` 新增 `pidTaskInputBuilder`，可把 role/phase/skill/upstream context 编成 PID worker 输入。
- `RuntimeRoleContext` 新增 `pidOutput`，真实 provider worker 输出会进入 roleRunner 并写入 workplace。
- 常驻 `agentruntime/main.ts` 增加 `CARVIS_AGENTRUNTIME_REAL_PROVIDERS=1` 模式。
- 真实模式下每个角色由 `PersistentPidAgentPool` 启动一个 provider worker PID，任务结束后保留到 runtime 统一 shutdown。
- prompt 构造会读取本角色 `skill.md`、`plan.md`，并按阶段注入 manager/writer/artist/researcher 的上游 result。

### 当前验证

- 本地 `npm run agentruntime:smoke`：通过。
- 本地 `npm run runtime-pidagent:smoke`：通过。
- 本地 `npm test`：通过。

### 剩余风险

- 真实 Qwen key 当前鉴权失败，NixOS 还不能完整运行五角色真实 provider 链。
- Claude Code SDK warm handle 仍不是无限多轮 stdin/stdout；本轮长驻的是 provider worker PID，DeepSeek Claude Code 调用仍由 worker 内部按任务启动 CLI print。

## 2026-07-02 / Manager review gate / 本次完成

### 本次完成

- 新增 run phase：`manager_reviewing`。
- Runtime 编排升级为 `manager planning -> writer/artist/researcher -> manager review -> engineer -> output`。
- manager 会在员工并行产出后第二次启动，执行复审 gate。
- engineer 只有在 manager review 结束后才启动。
- manager review 返回 `gatePassed: false` 时，runtime 会跳过 `engineer_building`，engineer 不启动。
- manager review 阶段的公开输出明确显示“主管复审”和“未达标不得交给 engineer 制作”。

### 测试基线

- 本地 `npm run build`：通过。
- 本地 `npm run agentruntime:smoke`：通过，断言 manager 启动两次且第二次早于 engineer，并覆盖 review fail 时跳过 engineer。
- 本地 `npm run workplaces:smoke`：通过，断言 manager review 文件和 result 追加。
- 本地 `npm test`：通过。
- 远端 NixOS 主管复审测试任务：通过。

### 剩余风险

- 当前复审是规则化静态审核；后续接入真实 Claude Code 时，应把员工 result 和 manager skill 一起注入 manager review prompt。
- 未通过时已经能阻断 engineer，但还没有自动返工循环。

## 2026-07-02 / Agent role skills pack / 本次完成

### 本次完成

- 新增 `src/agentruntime/skills/index.ts`，为 manager、writer、artist、researcher、engineer 各定义 3 个本地 skill。
- 每个 skill 包含 purpose、playbook、handoff、quality gate，用于约束角色产出和跨角色交接。
- `agentruntime/main.ts` 的公开流式输出新增 skill 加载、协作规则、消费输入、必须产出和验收门槛。
- 继续保持边界：不显示隐藏思考链，只显示可公开进度、技能加载和结果预览。

### 测试基线

- 本地 `npm run build`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm run build`：通过。
- 远端 NixOS 提交原创爬塔卡牌任务：通过，五角色结果汇总到 `output/final-report.md`。

### 剩余风险

- 当前 skill 包是本地静态指令；真实 Claude Code 长驻 PID 如果后续接入，需要把 `skill.md` 作为 system/context 文件传给对应 PID。

## 2026-07-02 / Current live role templates / 当前状态

### 当前事实

- 常驻 `agentruntime/main.ts` 连接 remote messagebus，订阅 Electron 提交的 `command.submitted`。
- 当前 production flow 是 `created -> parallel_roles_working -> engineer_building -> output_ready -> retaining_agents`。
- `manager`、`writer`、`artist`、`researcher` 在 `parallel_roles_working` 中并行启动；`engineer` 在四个前置角色结束后审计合并。
- `manager_planning` 和 `manager_reviewing` 仍保留在共享类型/辅助代码中，用于历史记录和兼容测试，不代表当前常驻生产流。
- 每个 agent 会流式发布中文公开进度和结果预览到 `agent.output`，Electron 面板追加显示最近 80 行。
- 真实 provider 模式下五个角色由 retained `providerWorker` 执行，manager/writer/engineer 走 DeepSeek Claude Code，artist/researcher 走 Qwen OpenAI-compatible；artist 可经本地 artist-image MCP wrapper 生成图片资产。
- 每个角色的 provider/model/usage 会写入对应 `usage.json`。
- IPC smoke 中通过 `CARVIS_AGENTRUNTIME_STREAM_DELAY_MS=1` 和 `CARVIS_AGENTRUNTIME_PREVIEW_DELAY_MS=1` 加速测试；真实 systemd 默认保留可见流式延迟。

### 当前验证

- 本地 `npm run typecheck`：通过。
- 远端 `carvis-agentruntime.service`：active。
- 远端 `pgrep` / systemd cgroup 显示 5 个 `dist/agentruntime/provider/providerWorker.js` PID active。
- 远端最新 `workplaces/runs/.../{manager,writer,artist,researcher,engineer}/usage.json` 存在。

## 2026-07-02 / Runtime 接入长驻 PID Agent 池 / 本次完成

### 本次完成

- `AgentRuntimeOptions` 新增 `pidAgentPool` 和 `pidTaskTimeoutMs`。
- Runtime role flow 可从 `PersistentPidAgentPool` 获取真实子进程 PID，并把 PID 写入 Agent lifecycle。
- PID Agent 的 task 输出会作为 `agent.output` 广播给 Electron shell。
- Runtime 收尾阶段统一调用 `pidAgentPool.shutdown()`，关闭 retained PID。
- 新增 `runtime-pidagent:smoke`，验证五角色流程使用真实子进程 PID、输出回传、最终 shutdown。

### 测试基线

- 本地 `npm run runtime-pidagent:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。

### 剩余风险

- 当前 Runtime 接入的是通用 line-protocol PID Agent 池。
- Claude Code CLI 本体尚未作为长驻交互 PID Agent 接入。

## 2026-07-02 / Local MVP smoke / 本次完成

### 当前目标

- 建立 AgentRuntime 最小调度核心，支撑 NixOS MVP smoke。

### 本次完成

- 新增 `src/agentruntime/README.md`
- 新增 `src/agentruntime/types.ts`
- 新增 `src/agentruntime/runtime.ts`
- 新增 `src/agentruntime/index.ts`
- 新增 `src/agentruntime/smoke.ts`
- 新增 `npm run agentruntime:smoke`
- Runtime 可订阅 `command.submitted`
- Runtime 可发布 `run.created`、`run.phase.changed`、Agent lifecycle、`runtime.heartbeat`、`output.ready`
- 固定角色顺序：manager planning -> writer/artist/researcher -> manager review -> engineer
- 模拟 PID Agent 在角色完成后进入 retained，最终统一 shutdown

### 测试基线

- `npm run agentruntime:smoke`：通过
- 远端 NixOS `npm run agentruntime:smoke`：通过

### 未完成

- PID 仍为模拟 PID，不是真实 Claude Code 子进程。
- 真实线程池、进程监督和长跑心跳尚未实现。

## 2026-07-01 / Phase 0 / 初始化

### 当前目标

固定多 Agent 调度、PID 池、线程池和心跳监督职责。

### 本次完成

- 明确 `agentruntime` 是多 Agent 管理运行时
- 明确线程池和心跳计时器归属 `agentruntime`
- 明确 PID Agent 完成单项任务后保持挂起，最终统一关闭
- 明确角色顺序：总管 -> 文书/美术/调研 -> 技术

### 当前状态

- 已完成：文档边界
- 进行中：无
- 未完成：任务队列、角色状态机、PID 池、心跳事件

### 下一步

- 补 `src/agentruntime/README.md`
- 定义 AgentRole、AgentStatus、RunPhase 类型

## 2026-07-02 / NixOS MVP 验收 / 补充

### 本次完成

- `agentruntime` 已接入 `createClaudeCodeRoleRunner` 用于真实 `mvp:real-smoke`。
- `e2e:smoke` 验证一条命令完整经过 runtime 状态机。
- `mvp:real-smoke` 验证 manager、writer、artist、researcher、engineer 五角色真实输出进入 workplace 并最终汇总。

### 测试基线

- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- 当前 runtime 仍使用模拟 PID 字段表示面板状态。
- 真实 Claude Code 执行是按角色短进程 print 调用，尚未升级为长驻 PID Agent。

## 2026-07-02 / 跨进程 IPC / 本次完成

### 本次完成

- `agentruntime/main.ts` 连接 TCP messagebus 并启动 runtime。
- `ipc:smoke` 验证独立 agentruntime 子进程可接收 `command.submitted` 并广播 run/agent/output 事件。

### 测试基线

- 本地 `npm run ipc:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。

### 剩余风险

- agentruntime 入口当前使用默认模拟角色 runner。
- 长驻 Claude Code PID 池仍待实现。

## 2026-07-02 / 长驻 PID Agent 池 / 本次完成

### 本次完成

- 新增 `src/agentruntime/pidagent/index.ts`。
- 新增 `PersistentPidAgentPool`，支持按角色创建/复用长驻子进程。
- 任务完成后 agent 标记 retained，进程不立即退出。
- `pool.shutdown()` 可统一关闭所有 retained PID。
- 新增 `pidagent:smoke` 验证同一角色 PID 复用、跨角色 PID 隔离、retained 状态和统一 shutdown。

### 测试基线

- 本地 `npm run pidagent:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- 当前 PID Agent 池使用 mock line protocol worker 验证生命周期。
- 尚未接入真实 Claude Code 长驻交互进程。
