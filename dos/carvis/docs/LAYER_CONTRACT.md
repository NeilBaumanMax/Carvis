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
manager    -> 与 writer/artist/researcher 并行启动，产出短任务边界、异常监控点、最小交付合同
writer     -> 产出文本、说明、结构、可数据化内容
artist     -> 产出视觉、素材计划，并可通过 artist-image MCP 生成本地图片资产
researcher -> 产出调研、事实、状态字段、测试检查
engineer   -> 审计前置角色结果，统一冲突，生成最终 output
```

## 文件契约

当前正式运行中，每个 run 的每个 workplace 包含：

```text
input.md
common/role.md
common/policy.md
skills/*.md
skills/selected.md
skill.md
plan.md
log.md
result.md
task_state.json
handoff_to_engineer.json
evidence_index.json
usage.json
```

`output/runs/<run>/` 包含：

```text
manifest.json
final-report.md
game-preview.html
assets/artist-*.png
```
