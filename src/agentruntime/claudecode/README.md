# Claude Code CLI Adapter

本目录用 TypeScript 封装 Claude Code CLI 子进程。

## 架构

```
claudecode/
  index.ts                    - barrel export
  deepseekClaudeCodeEnv.ts    - DeepSeek Anthropic 兼容环境变量
  spawn.ts                    - child_process.spawn 封装
  agent.ts                    - PID Agent 封装（prompt 注入 + I/O 捕获）
  manager.ts                  - Agent 生命周期管理（启停/保活/统一关闭）
  smoke.ts                    - 冒烟测试
```

## 模块说明

### spawn.ts

`spawnClaudeCode(config)` 启动一个 Claude Code CLI 子进程，返回 `ClaudeCodeProcess` 接口：

- `writeInput(text)` — 向 stdin 写入
- `closeStdin()` — 关闭 stdin
- `kill(signal)` — 发送信号
- `onStdoutLine(cb)` — 按行捕获 stdout
- `onStderrLine(cb)` — 按行捕获 stderr
- `onExit(cb)` — 监听退出（code + signal）
- `onError(cb)` — 监听进程错误（含 timeout）

`isClaudeCodeAvailable()` 检查 ANTHROPIC_AUTH_TOKEN 是否已设置。

### agent.ts

`createClaudeCodeAgent(config)` 基于 spawn 创建 PID Agent：

- 自动路由 stdout/stderr 到 messagebus（`agent.output` 事件）
- 退出时自动发布 `agent.done`（exit 0）或 `agent.error`（exit != 0）
- `writeInput(text)` / `closeStdin()` / `kill(signal)` / `waitForExit()`

`defaultRolePrompts()` 返回每个角色（manager/writer/artist/researcher/engineer）的默认 systemPrompt 和 userPrompt。

### manager.ts

`createAgentManager(config, busClient)` 管理 Agent 生命周期：

- `startAgent(role, agentId, runId, extraArgs)` — 启动指定角色 Agent
- `shutdownAll()` — 统一 SIGTERM 关闭全部 Agent
- `activeAgents` — 当前活跃 Agent Map

## DeepSeek 官方适配

```text
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_AUTH_TOKEN=<your DeepSeek API Key>
ANTHROPIC_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
CLAUDE_CODE_EFFORT_LEVEL=max
```

真实 Key 不能写进仓库，通过环境变量 `ANTHROPIC_AUTH_TOKEN` 注入。

## 冒烟测试

```bash
npm run claudecode:smoke
```

覆盖：
- stdout 捕获
- stderr 捕获
- 非零 exit code 分类
- timeout 检测（`agent_timeout`）
- stdin 写入
- kill 信号
- token 缺失检查
