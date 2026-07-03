# Qwen / Claude Code / Image 配置说明

> 当前状态：Carvis 已经实现 DeepSeek Claude Code 文本角色、Qwen OpenAI-compatible 文本角色，以及 Artist 专用 Qwen Image 生图链路。本文件只记录当前配置和验证方式，不包含真实 API Key。

## 1. 业务空间

本项目使用阿里云百炼 / Model Studio 默认业务空间：

```text
workspaceId = ws-a8dnumqf64i9ncca
workspaceHost = ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com
```

对应 Base URL：

```text
Claude Code / Anthropic-compatible:
https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/apps/anthropic

OpenAI-compatible chat / omni:
https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/compatible-mode/v1

DashScope native API:
https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/api/v1

Qwen-Image text-to-image endpoint:
https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
```

不要把真实 API Key 写入 Markdown、README、Git 仓库或聊天内容。

## 2. 当前模型分工

| 能力 | 当前模型/路由 | 接口 |
|---|---|---|
| manager | DeepSeek Claude Code | Claude Code CLI |
| writer | DeepSeek Claude Code | Claude Code CLI |
| engineer | DeepSeek Claude Code | Claude Code CLI |
| artist 文本规划 | `qwen3.5-omni-plus` | OpenAI-compatible |
| researcher | `qwen-plus`（可用 `QWEN_RESEARCHER_MODEL` 覆盖） | OpenAI-compatible Chat Completions + `enable_search` |
| artist 生图 | `qwen-image-2.0-pro` | DashScope native Qwen-Image API |

路由代码：

- `src/agentruntime/provider/roles.ts`
- `src/agentruntime/provider/qwenOpenAi.ts`
- `src/agentruntime/provider/qwenImage.ts`
- `src/agentruntime/mcp/artistImageMcp.ts`

Artist 生图只允许通过 artist-image MCP 包装器触发，普通角色不能直接调用。

## 3. 本地环境变量

推荐路径：

```bash
~/.config/carvis/agentruntime.env
```

内容模板：

```bash
# Qwen / Alibaba Cloud Model Studio
DASHSCOPE_API_KEY=在这里填入真实APIKey
QWEN_API_KEY=在这里填入同一把真实APIKey
QWEN_OPENAI_API_KEY=在这里填入同一把真实APIKey

# DeepSeek Claude Code / Anthropic-compatible
ANTHROPIC_AUTH_TOKEN=在这里填入DeepSeek或兼容服务APIKey
ANTHROPIC_BASE_URL=按实际 Claude Code 兼容端点填写
ANTHROPIC_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro[1m]

# Qwen Omni / OpenAI-compatible
QWEN_OPENAI_BASE_URL=https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
QWEN_OPENAI_MODEL=qwen3.5-omni-plus
QWEN_OMNI_MODEL=qwen3.5-omni-plus
QWEN_MODEL=qwen3.5-omni-plus
QWEN_RESEARCHER_MODEL=qwen-plus
CARVIS_QWEN_RESEARCHER_SEARCH=1

# Qwen Image / DashScope native
QWEN_DASHSCOPE_BASE_URL=https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/api/v1
QWEN_IMAGE_GENERATION_URL=https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
QWEN_IMAGE_MODEL=qwen-image-2.0-pro
QWEN_IMAGE_SIZE=1024*1024
QWEN_IMAGE_N=1
QWEN_IMAGE_WATERMARK=false
QWEN_IMAGE_PROMPT_EXTEND=true
CARVIS_QWEN_IMAGE_CONCURRENCY=2
CARVIS_QWEN_IMAGE_MAX_ATTEMPTS=3
CARVIS_QWEN_IMAGE_RETRY_DELAY_MS=12000

# Runtime speed defaults; Electron/NAS UI can override per command.
CARVIS_SPEED_MODE=auto
CARVIS_CLAUDE_CODE_USE_SDK=1
CARVIS_CLAUDE_CODE_SDK_FALLBACK=1
```

如果 shell 不支持 `${VAR}` 在 env 文件内展开，请直接写入具体值。不要提交该 env 文件。

## 4. Claude Code 配置

可使用 `~/.claude/settings.json` 注入 Claude Code 兼容环境变量。示例：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "请从本地安全来源读取，不要硬编码到仓库",
    "ANTHROPIC_BASE_URL": "按实际 Claude Code 兼容端点填写",
    "ANTHROPIC_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro[1m]",
    "CLAUDE_CODE_SUBAGENT_MODEL": "deepseek-v4-pro[1m]"
  }
}
```

同时确认 `~/.claude.json` 至少包含：

```json
{
  "hasCompletedOnboarding": true
}
```

## 5. Artist Image MCP 行为

流程：

1. Artist 先用 Qwen 文本模型输出视觉规划。
2. `artistImageMcp` 根据用户任务和 artist 输出生成短 JSON 图片计划。
3. `qwenImage` 并发生成 1-6 张图片，默认并发由 `CARVIS_QWEN_IMAGE_CONCURRENCY` 控制，兼容旧变量 `CARVIS_ARTIST_IMAGE_CONCURRENCY`。
4. 图片写入本次 `output/runs/<run>/assets/artist-*.png`。
5. Engineer prompt 只允许使用本轮真实 `assets/artist-*` 图片路径，不采信 writer/researcher 虚拟资产名。

图片比例和背景规则：

- 角色、敌人、伙伴、单位、头像、立绘、sprite、道具等可叠加资产：必须在 prompt 中声明 `透明背景 PNG`、`无场景背景`、`抠图/立绘`、`主体完整`、`边缘干净`。
- 背景、标题页、地图、场景：必须声明横向 16:9 或宽屏构图，并留出 UI 安全区。
- 流程图、徽章、卡牌、按钮、图标：按用途声明横向、竖向或细长比例，不默认正方形。
- `QWEN_IMAGE_SIZE` 仍是全局 API 参数；非正方形诉求通过每张图的 prompt 明确告诉 Qwen。后续如确认当前模型支持逐图 size 参数，再改成每资产传入 size。

生成结果会写进 artist 输出：

```text
## ARTIST_IMAGE_MCP_PLAN
## GENERATED_IMAGE_ASSETS
## ARTIST_IMAGE_MCP_SELF_REVIEW
```

## 6. Researcher Web Search

当前实现使用 OpenAI-compatible Chat Completions 的 `enable_search: true` 和 `search_options.forced_search`，只在 researcher 路由开启。不要让 Qwen 在未开启搜索时声称已联网检索。

阿里云 Responses API 的 `web_search` / `web_extractor` / `code_interpreter` 工具只支持特定模型，例如 `qwen3.7-plus`、`qwen3.6-plus`、`qwen3.5-plus`、对应 flash 版本，以及思考模式下的 `qwen3-max`。如果后续迁移到 Responses API，应同时开启 `web_search`、`web_extractor` 和 `code_interpreter`，并把 `QWEN_RESEARCHER_MODEL` 设置为支持工具的模型。

## 7. 验证命令

本地无真实 key 时：

```bash
npm run build
npm run provider:smoke
npm run artist-image-mcp:smoke
```

真实 Qwen 文本 smoke：

```bash
CARVIS_QWEN_REAL_SMOKE=1 npm run provider:smoke
```

完整 runtime smoke：

```bash
npm run agentruntime:smoke
npm run workplaces:smoke
npm run output:smoke
```

NixOS 服务验证：

```bash
systemctl --user is-active carvis-messagebus.service carvis-agentruntime.service carvis-electron.service
pgrep -af providerWorker
```

## 8. Usage 记录

每个角色完成后会在 workspace 写 `usage.json`：

- Qwen OpenAI-compatible route 记录真实 `prompt_tokens`、`completion_tokens`、`total_tokens`。
- DeepSeek Claude Code CLI route 当前记录 `estimated_*_tokens`，用于相对性能对比，不作为计费依据。

## 9. 当前已知优化点

- Writer 还需要进一步 schema 化，减少长文本输出。
- 仓库/长文档任务需要先生成短 task card，避免每个角色重复吃超长原始输入。
- DeepSeek route 如需真实 token usage，后续可评估绕过 Claude Code CLI，改为直接调用兼容 chat API。
- 当前 writer/engineer 共享 provider worker，并仅在同一 run 的非 fast/simple 任务中通过 Claude Code session resume 降低 engineer 重读成本；换 run 或轻度任务会隔离 session，防止旧 HTML/游戏上下文漂移。若 SDK resume 在某环境失败，会回退到原 `claude -p` 路径。
