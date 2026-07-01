# 02 MessageBus Progress

## 2026-07-01 / Phase 2 / 开工计划

### 当前目标

- 实现本地内存 messagebus 事件协议第一版，支撑 Phase 2 smoke test。

### 计划改动

- 新增 `src/messagebus` README、类型、总线实现、入口和 smoke test。
- 补充共享事件类型，让跨进程消息统一使用 envelope 字段。
- 在 `package.json` 增加 `messagebus:smoke`。

### 验收指标

- mock Electron 可发布 `command.submitted`，mock agentruntime 可收到。
- mock agentruntime 可广播 `runtime.heartbeat`，mock Electron 可收到。
- envelope 自动补齐 `eventId`、`timestamp`、`source`，并保留 `requestId` 或 `runId`。
- messagebus 不执行任务、不读写 workplace。

## 2026-07-01 / Phase 0 / 初始化

### 当前目标

固定本地消息总线的事件转发职责。

### 本次完成

- 明确 messagebus 连接 Electron 和 agentruntime
- 明确 messagebus 不执行任务、不读写 workplace
- 明确最小事件 envelope 和事件类型

### 当前状态

- 已完成：文档边界
- 进行中：无
- 未完成：IPC/WebSocket 选型、事件类型、smoke test

### 下一步

- 补 `src/messagebus/README.md`
- 定义 command/run/agent/heartbeat/output 事件类型
