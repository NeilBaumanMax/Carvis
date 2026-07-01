# Carvis Layer Contract

## 调用方向

允许方向：

```text
setup -> messagebus
setup -> agentruntime
setup -> electron
electron -> messagebus
messagebus -> agentruntime
agentruntime -> claudecode
agentruntime -> workplaces
agentruntime -> output
```

禁止方向：

```text
electron -> claudecode
electron -> workplaces write
messagebus -> claudecode
messagebus -> output write
claudecode -> electron
workplaces -> agentruntime control
output -> agentruntime control
```

## 事件契约

所有跨进程消息必须带 envelope：

```text
eventId
type
timestamp
source
target
requestId
runId
agentId
payload
```

## 最小事件类型

```text
command.submitted
run.created
run.phase.changed
agent.starting
agent.ready
agent.output
agent.error
agent.done
agent.retained
agent.shutdown
runtime.heartbeat
output.ready
```

## 角色契约

```text
manager    -> 拆解任务，不产出最终产品
writer     -> 产出文本、说明、结构
artist     -> 产出视觉、素材、界面建议
researcher -> 产出调研、事实、引用材料
engineer   -> 汇总前置角色结果，生成 output
```

## 文件契约

每个 workplace 建议包含：

```text
input.md
plan.md
log.md
result.md
artifacts/
```

`output/` 建议包含：

```text
manifest.json
final-report.md
artifacts/
```
