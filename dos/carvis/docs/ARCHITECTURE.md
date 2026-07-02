# Carvis Architecture

## 总览

Carvis 是一个用 TypeScript 编写、运行在 NixOS 上的本地多进程多 Agent 协同系统。

```text
NixOS
  -> setup
      -> messagebus
      -> agentruntime
      -> electron

electron <-> messagebus <-> agentruntime
                              -> retained providerWorker pool
                                 -> DeepSeek Claude Code CLI
                                 -> Qwen OpenAI-compatible text
                                 -> artist-image MCP wrapper
                              -> workplaces/runs/<run>/*
                              -> output/runs/<run>/*
```

## 当前生产形态

截至 2026-07-03 SSH readback，NixOS 远端运行目录是 `~/carvis-remote-smoke`。

- `carvis-messagebus.service`：active，运行 `dist/messagebus/main.js`。
- `carvis-agentruntime.service`：active，运行 `dist/agentruntime/main.js`，并保留 5 个 `providerWorker` PID。
- `carvis-electron.service`：active，运行 `dist/electron/runBrowserMain.js`，通过 NixOS Electron 41.7.2 runtime 启动窗口。
- `agentruntime` 使用本地 `~/.config/carvis/agentruntime.env` 注入 secret，仓库不保存 API Key。
- 每次任务写入 `workplaces/runs/<timestamp-request>/` 和 `output/runs/<timestamp-request>/`。
- 每个角色的 provider/model/usage 写入对应 `usage.json`。

## 核心链路

用户输入：

```text
Electron input
  -> messagebus command.submitted
  -> agentruntime run.created
  -> manager / writer / artist / researcher provider workers in parallel
  -> engineer PID Agent
  -> output generated
  -> messagebus output.ready
  -> Electron preview
```

状态回传：

```text
PID stdout/stderr
  -> claudecode wrapper
  -> agentruntime event normalization
  -> messagebus broadcast
  -> Electron workplace panels
```

## 进程边界

- `setup` 是启动监督边界。
- `messagebus` 是进程间通信边界。
- `agentruntime` 是调度和 PID 生命周期边界。
- `claudecode` 是子进程封装边界。
- `electron` 是用户交互和展示边界。

## 数据边界

```text
workplaces/runs/<run>/manager     -> 总管边界、异常监控、最小合同
workplaces/runs/<run>/writer      -> 文书阶段产物
workplaces/runs/<run>/artist      -> 美术阶段产物和图片资产计划
workplaces/runs/<run>/researcher  -> 调研、状态字段、测试检查
workplaces/runs/<run>/engineer    -> 技术汇总过程和最终 HTML
output/runs/<run>/                -> 最终可预览产物
```

## Agent 生命周期

```text
idle -> starting -> ready -> assigned -> working -> waiting -> done -> retained -> shutdown
```

说明：

- `done` 表示当前任务完成。
- `retained` 表示外层 provider worker PID 保持存活等待后续统一关闭。
- `shutdown` 只能由 agentruntime 统一触发。

## 心跳设计

心跳主归属：`agentruntime`

心跳传播归属：`messagebus`

心跳展示归属：`electron`

建议 heartbeat 字段：

```text
runId
timestamp
activePidCount
idlePidCount
retainedPidCount
queueDepth
currentPhase
agents[]
```

每个 Agent 心跳建议字段：

```text
agentId
role
pid
status
workplacePath
lastOutputAt
lastHeartbeatAt
currentTaskId
```
