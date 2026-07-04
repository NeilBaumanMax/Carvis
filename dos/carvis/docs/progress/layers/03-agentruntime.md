# 03 AgentRuntime Progress

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

---

## 2026-07-04 / Phase 4 / 开工计划

### 当前目标

实现 agentruntime 调度核心的最小状态机。包含：
- 任务队列（先进先出，支持 runId 追踪）
- PID Agent 池（创建、复用、状态追踪、统一 shutdown）
- 调度状态机（RunPhase 流转：created → manager_planning → parallel_roles_working → engineer_building → output_ready → retaining_agents → shutdown）
- 角色编排：总管先启动，文书/美术/调研并行，技术等待前置完成后启动
- 心跳计时器（周期性通过 messagebus 发布 `runtime.heartbeat`）
- PID 保活策略：done 后进入 retained，全部结束后统一 shutdown

### 计划改动

- 新增 `src/agentruntime/types.ts`：RuntimeConfig、TaskItem、PoolSnapshot、SchedulerState
- 新增 `src/agentruntime/pool.ts`：AgentPool（创建/复用/shutdown PID Agent 槽位）
- 新增 `src/agentruntime/scheduler.ts`：TaskScheduler（状态机驱动角色编排）
- 新增 `src/agentruntime/heartbeat.ts`：HeartbeatTimer（周期性心跳发布）
- 新增 `src/agentruntime/messagebus/client.ts`：RuntimeBusClient（runtime 侧消息总线适配）
- 新增 `src/agentruntime/index.ts`：公开导出
- 新增 `src/agentruntime/README.md`：职责边界文档
- 新增 `src/agentruntime/smoke.ts`：smoke test（验证角色流程、并发、shutdown）
- `package.json` 新增 `agentruntime:smoke` 脚本
- `src/shared/types/events.ts` 补充 agentruntime 专用事件 payload

### 验收指标

- `npm run typecheck` 通过
- `npm run agentruntime:smoke` 通过
- 角色流程：manager → [writer, artist, researcher] → engineer 顺序可断言
- 并发角色在 parallel_roles_working 阶段并行推进
- shutdown 后 activePidCount 归零
- heartbeat 周期在配置范围内

---

## 2026-07-04 / Phase 4 / 收尾

### 本轮完成

- Phase 4 agentruntime 调度核心代码已完成。
- 新增 `src/agentruntime/types.ts`：RuntimeConfig、TaskItem、PoolSnapshot、SchedulerState、ROLE_FLOW、状态转换校验。
- 新增 `src/agentruntime/pool.ts`：AgentPool（创建、状态追踪、snapshot、统一 shutdown）。
- 新增 `src/agentruntime/scheduler.ts`：TaskScheduler（RunPhase 状态机，驱动角色编排流程）。
- 新增 `src/agentruntime/heartbeat.ts`：HeartbeatTimer（周期性发布 runtime.heartbeat）。
- 新增 `src/agentruntime/messagebus/client.ts`：RuntimeBusClient（订阅命令、发布心跳/agent 事件/output）。
- 新增 `src/agentruntime/README.md`：职责边界文档。
- 新增 `src/agentruntime/smoke.ts`：覆盖角色流程、并发推进、shutdown 验证、心跳验证。
- `package.json` 新增 `agentruntime:smoke` 脚本。
- `npm run typecheck`、`npm run agentruntime:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke`、`npm run electron:smoke` 均通过。

### 当前状态

- 已完成：任务队列、AgentPool、TaskScheduler 状态机、HeartbeatTimer、RuntimeBusClient
- 进行中：无
- 未完成：真实 Claude Code CLI PID 启动（Phase 5）、workplaces 物理目录管理（Phase 6）

### 下一步

- Phase 5：Claude Code CLI PID 封装，接入 `src/agentruntime/claudecode`，建立 `claudecode:smoke`。
