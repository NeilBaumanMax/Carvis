# Carvis Agent Loop

## 单次用户命令循环

```text
1. Electron 收到用户回车输入
2. Electron 发布 command.submitted
3. agentruntime 创建 run
4. agentruntime 启动或复用 manager PID Agent
5. manager 生成任务拆解
6. agentruntime 根据拆解分配 writer / artist / researcher
7. writer / artist / researcher 并行或按依赖运行
8. agentruntime 等待前置角色完成
9. agentruntime 启动或复用 engineer PID Agent
10. engineer 读取各 workplace，生成 output
11. agentruntime 广播 output.ready
12. Electron 展示产物
13. agentruntime 将 PID Agent 标记 retained
14. 全部 run 完成后统一 shutdown
```

## PID 保活规则

- 单个 Agent 完成当前任务后进入 `retained`。
- `retained` PID 不接收新任务时只保留进程和上下文。
- 如果发生进程崩溃，agentruntime 记录失败并决定是否重启。
- 用户明确结束或全部任务完成后，agentruntime 统一关闭 PID。

## 失败规则

最小失败分类：

```text
startup_failed
agent_timeout
agent_exit_nonzero
messagebus_disconnected
output_missing
runtime_internal_error
```

失败必须通过 messagebus 广播给 Electron，并写入施工或运行日志。
