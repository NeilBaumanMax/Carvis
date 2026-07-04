# 02 MessageBus Progress

## 2026-07-04 / Phase 4 / 开工计划

### 当前目标

- 补齐 messagebus 本地长跑入口，让完整启动命令能实际拉起消息总线进程占位。

### 计划改动

- 新增或调整 messagebus 进程入口。
- 保持 messagebus 只负责事件协议和进程存活，不执行任务、不读写 workplace。

### 验收指标

- `npm run messagebus:smoke` 通过。
- 完整启动 smoke 能看到 messagebus 入口被 setup 拉起。

### 本次完成

- 新增 `src/messagebus/main.ts` 作为 messagebus 长跑入口。
- 完整启动时 messagebus 会启动内存协议占位进程并等待 shutdown。
- 保持 messagebus 不执行任务、不读写 workplace。

### 验证结果

- `npm run messagebus:smoke`：通过。
- `npm run start:full:smoke`：通过。

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
