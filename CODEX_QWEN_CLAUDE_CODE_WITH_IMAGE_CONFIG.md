# Codex 配置说明：为当前 Qwen / Claude Code 方案补齐生图能力

> 目标：在现有 Claude Code + Qwen 多模态方案中，新增真正的文生图能力。  
> 重要结论：`qwen3.5-omni-plus` 负责文本、图片、音频、视频理解；它不是生图模型。真正文生图请使用 `qwen-image-2.0-pro`。

---

## 1. 当前业务空间信息

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

不要把真实 API Key 写入本 Markdown、README、Git 仓库或 Codex 聊天内容。

---

## 2. 模型分工

请按下面的分工配置，不要把所有能力强行塞给 `qwen3.5-omni-plus`。

| 能力 | 模型 | 接口 |
|---|---|---|
| Claude Code 开发 | `qwen3-coder-plus`，备选 `qwen3.7-plus` | Anthropic-compatible |
| 文本理解 / 规划 / 总结 | `qwen3.5-omni-plus` | OpenAI-compatible |
| 图片理解 / OCR / 多模态问答 | `qwen3.5-omni-plus` | OpenAI-compatible |
| 音频 / 视频理解 | `qwen3.5-omni-plus` | OpenAI-compatible |
| 文生图 / 中文海报 / 封面图 | `qwen-image-2.0-pro` | DashScope native Qwen-Image API |

---

## 3. 需要写入的环境变量

请在本地配置文件中写入，不要提交到 Git。

推荐路径：

```bash
~/.config/carvis/agentruntime.env
```

内容模板：

```bash
# =========================
# Qwen / Alibaba Cloud Model Studio
# =========================
# 请在本地填入真实 API Key，不要写入仓库。
DASHSCOPE_API_KEY=在这里填入真实APIKey
QWEN_API_KEY=在这里填入同一把真实APIKey
QWEN_OPENAI_API_KEY=在这里填入同一把真实APIKey

# =========================
# Claude Code / Anthropic-compatible
# =========================
ANTHROPIC_AUTH_TOKEN=${DASHSCOPE_API_KEY}
ANTHROPIC_BASE_URL=https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/apps/anthropic
ANTHROPIC_MODEL=qwen3-coder-plus
ANTHROPIC_DEFAULT_HAIKU_MODEL=qwen3-coder-plus
ANTHROPIC_DEFAULT_SONNET_MODEL=qwen3-coder-plus
ANTHROPIC_DEFAULT_OPUS_MODEL=qwen3-coder-plus
CLAUDE_CODE_SUBAGENT_MODEL=qwen3-coder-plus

# =========================
# Qwen Omni / OpenAI-compatible
# =========================
QWEN_OPENAI_BASE_URL=https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
QWEN_OPENAI_MODEL=qwen3.5-omni-plus
QWEN_OMNI_MODEL=qwen3.5-omni-plus
QWEN_MODEL=qwen3.5-omni-plus

# =========================
# Qwen Image / DashScope native
# =========================
QWEN_DASHSCOPE_BASE_URL=https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/api/v1
QWEN_IMAGE_GENERATION_URL=https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
QWEN_IMAGE_MODEL=qwen-image-2.0-pro
QWEN_IMAGE_SIZE=1024*1024
QWEN_IMAGE_N=1
QWEN_IMAGE_WATERMARK=false
QWEN_IMAGE_PROMPT_EXTEND=true
CARVIS_ARTIST_IMAGE_CONCURRENCY=2
CARVIS_QWEN_IMAGE_MAX_ATTEMPTS=3
CARVIS_QWEN_IMAGE_RETRY_DELAY_MS=12000
```

如果 shell 不支持 `${DASHSCOPE_API_KEY}` 在 env 文件内展开，请直接把同一把 Key 分别填入 `ANTHROPIC_AUTH_TOKEN`、`QWEN_API_KEY` 和 `QWEN_OPENAI_API_KEY`。

---

## 4. Claude Code 配置文件

请更新或创建：

```bash
~/.claude/settings.json
```

内容模板：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "请从本地安全来源读取，不要硬编码到仓库",
    "ANTHROPIC_BASE_URL": "https://ws-a8dnumqf64i9ncca.cn-beijing.maas.aliyuncs.com/apps/anthropic",
    "ANTHROPIC_MODEL": "qwen3-coder-plus",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "qwen3-coder-plus",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "qwen3-coder-plus",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "qwen3-coder-plus",
    "CLAUDE_CODE_SUBAGENT_MODEL": "qwen3-coder-plus"
  }
}
```

同时确认：

```bash
~/.claude.json
```

至少包含：

```json
{
  "hasCompletedOnboarding": true
}
```

---

## 5. 需要 Codex 修改的业务路由

请把当前 Carvis / agentruntime 的模型路由改成：

```text
manager  -> DeepSeek Claude Code
writer   -> DeepSeek Claude Code
engineer -> DeepSeek Claude Code
researcher -> qwen3.5-omni-plus
artist_understanding -> qwen3.5-omni-plus
artist_image_generation -> qwen-image-2.0-pro
```

当前策略：Writer 负责长文本剧情/结构化文案，默认改走 DeepSeek；Qwen 保留给 Artist/Researcher，尤其不要破坏 Artist 的 Qwen Image 生图链路。

如果当前只有一个 `artist` 角色，请拆成两种任务：

```text
artist.mode = "understand"  -> Qwen Omni
artist.mode = "generate_image" -> Qwen Image
```

推荐统一任务类型：

```ts
export type AiTaskType =
  | "text"
  | "vision"
  | "audio"
  | "video"
  | "image_generation";
```

---

## 6. 新增 Qwen Image Provider

请新增文件，例如：

```text
src/agentruntime/provider/qwenImage.ts
```

参考实现：

```ts
export type QwenImageRequest = {
  prompt: string;
  size?: string;
  negativePrompt?: string;
  n?: number;
};

export type QwenImageResult = {
  imageUrls: string[];
  raw: unknown;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function extractImageUrls(data: any): string[] {
  const urls: string[] = [];
  const choices = data?.output?.choices ?? [];

  for (const choice of choices) {
    const content = choice?.message?.content ?? [];
    for (const item of content) {
      if (typeof item?.image === "string") urls.push(item.image);
      if (typeof item?.url === "string") urls.push(item.url);
    }
  }

  return urls;
}

export async function callQwenImage(req: QwenImageRequest): Promise<QwenImageResult> {
  const apiKey =
    process.env.DASHSCOPE_API_KEY ||
    process.env.QWEN_API_KEY ||
    process.env.QWEN_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing DASHSCOPE_API_KEY / QWEN_API_KEY / QWEN_OPENAI_API_KEY");
  }

  const endpoint =
    process.env.QWEN_IMAGE_GENERATION_URL ||
    `${requireEnv("QWEN_DASHSCOPE_BASE_URL")}/services/aigc/multimodal-generation/generation`;

  const model = process.env.QWEN_IMAGE_MODEL || "qwen-image-2.0-pro";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: {
        messages: [
          {
            role: "user",
            content: [
              {
                text: req.prompt,
              },
            ],
          },
        ],
      },
      parameters: {
        size: req.size || process.env.QWEN_IMAGE_SIZE || "2048*2048",
        n: req.n || Number(process.env.QWEN_IMAGE_N || 1),
        prompt_extend: process.env.QWEN_IMAGE_PROMPT_EXTEND !== "false",
        watermark: process.env.QWEN_IMAGE_WATERMARK === "true",
        negative_prompt:
          req.negativePrompt ||
          "低清晰度，低画质，错字，文字扭曲，水印，畸形，构图混乱，多余文字",
      },
    }),
  });

  const data = await response.json();

  if (!response.ok || data?.code) {
    throw new Error(data?.message || `Qwen image generation failed: ${response.status}`);
  }

  const imageUrls = extractImageUrls(data);

  if (imageUrls.length === 0) {
    throw new Error("Qwen image generation succeeded but no image URL was found in response");
  }

  return {
    imageUrls,
    raw: data,
  };
}
```

注意：生成图片返回的 URL 可能不是永久地址。业务侧应及时下载到自己的对象存储或本地文件系统，再返回稳定 URL 给前端。

---

## 7. 新增 image smoke 测试

请新增一个 smoke 脚本，例如：

```text
scripts/qwen-image-smoke.ts
```

逻辑：

```ts
import { callQwenImage } from "../src/agentruntime/provider/qwenImage";

async function main() {
  const result = await callQwenImage({
    prompt:
      "生成一张中文科技海报，主标题写「AI 赋能增长」，蓝白配色，现代感，适合公司发布会，无水印。",
    size: "2048*2048",
    n: 1,
  });

  console.log("Qwen Image smoke passed:");
  console.log(result.imageUrls.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

在 `package.json` 增加：

```json
{
  "scripts": {
    "provider:qwen-image-smoke": "tsx scripts/qwen-image-smoke.ts"
  }
}
```

运行：

```bash
set -a
source ~/.config/carvis/agentruntime.env
set +a

npm run provider:qwen-image-smoke
```

---

## 8. 最小 curl 测试

如果 TypeScript smoke 失败，先用 curl 确认 API 是否连通：

```bash
set -a
source ~/.config/carvis/agentruntime.env
set +a

curl -X POST "$QWEN_IMAGE_GENERATION_URL" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-image-2.0-pro",
    "input": {
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "text": "生成一张中文科技海报，主标题写「AI 赋能增长」，蓝白配色，现代感，无水印。"
            }
          ]
        }
      ]
    },
    "parameters": {
      "size": "2048*2048",
      "n": 1,
      "prompt_extend": true,
      "watermark": false,
      "negative_prompt": "低清晰度，低画质，错字，文字扭曲，水印，构图混乱"
    }
  }'
```

---

## 9. 统一 API 返回格式

建议让业务层统一返回：

```ts
export type AiResponse =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "image";
      imageUrls: string[];
      prompt: string;
      provider: "qwen-image";
      model: string;
    };
```

前端只关心：

```text
POST /api/ai
```

请求例子：

```json
{
  "task": "image_generation",
  "prompt": "生成一张中文科技海报，主标题写「AI赋能增长」，蓝白配色，现代感",
  "size": "2048*2048"
}
```

返回例子：

```json
{
  "type": "image",
  "imageUrls": ["https://..."],
  "prompt": "生成一张中文科技海报...",
  "provider": "qwen-image",
  "model": "qwen-image-2.0-pro"
}
```

---

## 10. Codex 执行要求

请 Codex 按以下顺序执行：

1. 不要读取或输出真实 API Key。
2. 更新 `~/.config/carvis/agentruntime.env` 示例变量，新增 Qwen Image 配置。
3. 新增 `src/agentruntime/provider/qwenImage.ts`。
4. 新增 image smoke 脚本。
5. 修改 provider 路由：`image_generation` 任务走 Qwen Image。
6. 保留 `qwen3.5-omni-plus` 作为理解模型，不要用它生图。
7. 先运行最小 curl，再运行 `npm run provider:qwen-image-smoke`。
8. 只有 Qwen Image smoke 成功后，再启用完整 real providers。
9. 不要把任何密钥、CSV、`.env`、`agentruntime.env` 提交到 Git。

---

## 11. 验收标准

完成后必须满足：

```bash
CARVIS_QWEN_REAL_SMOKE=1 npm run provider:smoke
npm run provider:qwen-image-smoke
CARVIS_AGENTRUNTIME_REAL_PROVIDERS=1 npm run provider:smoke
```

其中：

- `provider:smoke` 能验证文本 / 多模态理解链路。
- `provider:qwen-image-smoke` 能返回至少一个图片 URL。
- 完整 real providers 能按任务类型正确路由。

---

## 12. 一句话总结

当前方案要补齐生图能力，必须新增 `qwen-image-2.0-pro` 和 DashScope 原生文生图接口；`qwen3.5-omni-plus` 继续保留为多模态理解模型，不能替代文生图模型。
