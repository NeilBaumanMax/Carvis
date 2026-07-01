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

## NixOS Claude Code 执行方式

Claude Code 的 npm 包包含通用 Linux 原生二进制。在 NixOS 上直接运行可能触发动态链接器错误。当前远端测试通过的方式是用 `steam-run` 包一层：

```text
CARVIS_CLAUDE_CODE_RUNNER=steam-run
CARVIS_CLAUDE_CODE_BIN=/home/howtion/.npm/_npx/<cache>/node_modules/@anthropic-ai/claude-code-linux-x64/claude
```

`claudecode:smoke` 默认只做 dry check。真实 API 测试需要显式设置：

```text
CARVIS_CLAUDECODE_REAL_SMOKE=1
DEEPSEEK_API_KEY=<your DeepSeek API Key>
npm run claudecode:smoke
```

真实 smoke 会使用 `--print` 非交互模式、禁用工具，并限制 `--max-budget-usd`。

## Claude Agent SDK warm runner

`claudecode:sdk-smoke` 使用 `@anthropic-ai/claude-agent-sdk` 的 `startup()` 预热 Claude Code 子进程。SDK 的 `WarmQuery.query()` 每个 warm handle 只能调用一次，所以当前策略是：

1. 任务到达前预热一个 Claude Code 子进程；
2. 任务分配时直接向 warm handle 提交 prompt；
3. 本轮 query 结束后重新预热下一轮。

在 NixOS 上同样使用：

```text
CARVIS_CLAUDE_CODE_RUNNER=steam-run
CARVIS_CLAUDE_CODE_BIN=/home/howtion/.npm/_npx/<cache>/node_modules/@anthropic-ai/claude-code-linux-x64/claude
```

真实 SDK smoke：

```text
CARVIS_CLAUDECODE_SDK_REAL_SMOKE=1
DEEPSEEK_API_KEY=<your DeepSeek API Key>
npm run claudecode:sdk-smoke
```

真实 MVP smoke 可显式切换到 SDK warm runner：

```text
CARVIS_REAL_MVP_SMOKE=1
CARVIS_REAL_MVP_USE_SDK=1
DEEPSEEK_API_KEY=<your DeepSeek API Key>
npm run mvp:real-smoke
```
