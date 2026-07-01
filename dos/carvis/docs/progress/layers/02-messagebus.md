# 02 MessageBus Progress

## 2026-07-02 / IPC 重连 / 本次完成

### 本次完成

- remote messagebus client 增加断线重连。
- 连接关闭后会 reject pending request，清空 socket buffer，并在仍有订阅时自动重连。
- 重连成功后重新注册已有订阅。
- 新增 `ipc:reconnect-smoke`，覆盖 agentruntime 先启动、messagebus 后启动的启动顺序。
- `npm test` 已包含 `ipc:reconnect-smoke`。

### 测试基线

- 本地 `npm run ipc:reconnect-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。

### 剩余风险

- 尚未实现协议认证、版本协商、背压和持久化队列。

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

### 本次完成

- 新增 `src/messagebus/README.md`
- 新增 `src/messagebus/types.ts`
- 新增 `src/messagebus/bus.ts`
- 新增 `src/messagebus/index.ts`
- 新增 `src/messagebus/smoke.ts`
- 新增共享 payload 类型：`CommandSubmittedPayload`、`RuntimeHeartbeatPayload`、`AgentOutputPayload`、`OutputReadyPayload`
- 新增 `npm run messagebus:smoke`

### 当前状态

- 已完成：Phase 2 内存事件协议和 smoke test
- 进行中：无
- 未完成：真实 IPC/WebSocket 传输、断连错误事件、agentruntime 侧 messagebus client

### 测试基线

- `npm run typecheck`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过

### 下一步

- Phase 3 先做 Electron 最小外壳，通过 messagebus 发布 `command.submitted` 并订阅 `runtime.heartbeat`。

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

## 2026-07-02 / NixOS MVP 验收 / 补充

### 本次完成

- `e2e:smoke` 验证 `command.submitted` 从 Electron shell 经 messagebus 到 agentruntime。
- `e2e:smoke` 验证 `runtime.heartbeat`、Agent lifecycle、`agent.output`、`output.ready` 从 agentruntime 经 messagebus 回到 Electron shell。
- NixOS `npm test` 已覆盖 messagebus smoke 和完整 e2e 链路。

### 测试基线

- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- 当前 messagebus 是进程内实现，真实 IPC/WebSocket 传输尚未实现。
- setup spawn 已有三个进程入口，但它们之间尚未接入真实跨进程总线。

## 2026-07-02 / 跨进程 IPC / 本次完成

### 本次完成

- 新增 TCP JSONL messagebus server/client。
- `messagebus/main.ts` 现在启动真实 TCP server。
- remote client 保持 `MessageBus` 接口，支持 publish/subscribe/unsubscribe。
- 修复远程订阅初次连接时重复注册的问题。
- 新增 `ipc:smoke`，验证真实 messagebus 子进程可转发 Electron shell 与 agentruntime 子进程之间的事件。

### 测试基线

- 本地 `npm run ipc:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。

### 剩余风险

- 还没有断线重连、协议版本、认证和背压处理。
