# src/agentruntime

## 职责

`agentruntime` 是 Carvis 的多 Agent 管理运行时，负责：

- 维护任务队列和 Run 生命周期
- 管理 PID Agent 池（创建、复用、状态追踪、关闭）
- 角色调度：总管 → 文书/美术/调研（并行）→ 技术
- 心跳计时器与监督日志
- 通过 messagebus 接收用户命令、发布状态和 heartbeat
- PID Agent 保活策略：子任务完成后保留进程，全部结束后统一 shutdown
- 角色 skills 注入和工作目录分配

## 禁止事项

- 不直接渲染 UI
- 不绕过 messagebus 直接与 Electron 通信
- 不把角色工作文件写到 runtime 根目录
- 不把 provider API Key 写死在代码里
- 不直接调用 Claude Code CLI（由 `claudecode` 子层封装，Phase 5+）

## 子层

| 目录 | 职责 |
|------|------|
| `claudecode/` | Claude Code CLI 进程封装（环境变量、启动、I/O 捕获） |
| `mcp/` | MCP 工具桥接（预留） |
| `messagebus/` | runtime 侧消息总线适配（订阅命令、发布状态） |
| `workplaces/` | 角色工作隔间目录 |

## 当前状态

Phase 4：调度核心最小状态机已实现。
- 任务队列、AgentPool、TaskScheduler、HeartbeatTimer 已就绪
- mock Agent 执行（无真实 Claude Code CLI，属 Phase 5）
- 角色编排流程：manager → [writer, artist, researcher] → engineer
- `agentruntime:smoke` 覆盖角色流程、并发、shutdown
