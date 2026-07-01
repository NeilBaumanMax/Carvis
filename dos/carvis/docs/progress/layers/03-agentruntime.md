# 03 AgentRuntime Progress

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
- 固定角色顺序：manager -> writer/artist/researcher -> engineer
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
