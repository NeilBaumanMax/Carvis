# Claude Code CLI Adapter

本目录用 TypeScript 封装 Claude Code CLI 子进程。

## DeepSeek 官方适配

按照 DeepSeek 官方 Claude Code 接入文档，Claude Code 使用 Anthropic 兼容端点：

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

真实 Key 只能放在本机环境变量或本地 secret 文件中，不能写进仓库。

## Current wrapper

`agent.ts` starts a Claude Code CLI PID Agent with `child_process.spawn`, writes the role prompt to stdin, captures stdout/stderr, and streams output through messagebus as `agent.output.stream`.

Runtime mode:

```text
CARVIS_CLAUDE_MODE=mock  -> use mock orchestration path
CARVIS_CLAUDE_MODE=real  -> call the real claude CLI through agent.ts
```

Timeout:

```text
CARVIS_AGENT_TIMEOUT_MS=300000
```

CLI command override:

```text
CARVIS_CLAUDECODE_BIN=claude
```
