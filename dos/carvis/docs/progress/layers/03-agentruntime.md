# 03 AgentRuntime Progress

## 2026-07-04 / Phase 4 / 开工计划

### 当前目标

- 实现 agentruntime 最小可运行骨架，使完整启动命令能实际拉起 runtime 进程。
- 建立最小 heartbeat/状态机 smoke，为后续多 Agent 调度核心继续开发。

### 计划改动

- 新增 `src/agentruntime/README.md`。
- 新增 agentruntime 类型、runtime 骨架、入口和 smoke test。
- 先用 mock 状态机固定角色顺序和 heartbeat 字段，不启动真实 Claude Code PID。

### 验收指标

- `npm run agentruntime:smoke` 通过。
- `npm run start:full:smoke` 能证明 agentruntime 入口被 setup 拉起。
- agentruntime 不渲染 UI、不绕过 messagebus、不把角色工作文件写到 runtime 根目录。

### 本次完成

- 新增 `src/agentruntime/README.md`。
- 新增 `src/agentruntime/runtime.ts`，建立最小 AgentRuntime 状态机。
- 新增 `src/agentruntime/main.ts`，作为 agentruntime 长跑入口并周期发布 heartbeat。
- 新增 `src/agentruntime/smoke.ts`，验证角色顺序、heartbeat 和 output ready。
- 当前仍不启动真实 Claude Code PID Agent，后续 Phase 5 继续实现。

### 验证结果

- `npm run agentruntime:smoke`：通过。
- `npm run start:full:smoke`：通过。

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
