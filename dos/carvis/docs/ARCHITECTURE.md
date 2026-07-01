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
                              -> claudecode PID Agent pool (DeepSeek Anthropic endpoint)
                              -> workplaces/*
                              -> output/*
```

## 核心链路

用户输入：

```text
Electron input
  -> messagebus command.submitted
  -> agentruntime run.created
  -> manager PID Agent
  -> writer / artist / researcher PID Agents
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
workplaces/manager     -> 总管拆解和任务计划
workplaces/writer      -> 文书阶段产物
workplaces/artist      -> 美术阶段产物
workplaces/researcher  -> 调研阶段产物
workplaces/engineer    -> 技术汇总过程
output/                -> 最终可预览产物
```

## Agent 生命周期

```text
idle -> starting -> ready -> assigned -> working -> waiting -> done -> retained -> shutdown
```

说明：

- `done` 表示当前任务完成。
- `retained` 表示 PID Agent 保持存活等待后续统一关闭。
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
