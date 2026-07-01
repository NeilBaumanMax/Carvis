# 02 MessageBus Progress

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
