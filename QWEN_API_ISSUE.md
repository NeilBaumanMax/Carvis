# Qwen API Issue

## Summary

Carvis code now supports routing `writer`, `artist`, and `researcher` to Qwen through an OpenAI-compatible chat completions client, but the current Qwen API credential cannot pass real authentication on NixOS.

No real API key is stored in this file.

## Expected Use

- Roles: `writer`, `artist`, `researcher`
- Model target: `qwen3.5-omni-plus`
- Client path: `src/agentruntime/provider/qwenOpenAi.ts`
- Runtime mode: `CARVIS_AGENTRUNTIME_REAL_PROVIDERS=1`
- Local secret file on NixOS: `~/.config/carvis/agentruntime.env`

## Verified Working Parts

- NixOS default route uses WiFi first: `wlan0`.
- NixOS can reach DeepSeek and DashScope domains.
- DeepSeek Claude Code real smoke works.
- Five-role all-DeepSeek real MVP smoke works with both:
  - `CARVIS_REAL_MVP_USE_SDK=0`
  - `CARVIS_REAL_MVP_USE_SDK=1`
- Local dry provider route smoke works:
  - `manager` -> DeepSeek Claude Code
  - `engineer` -> DeepSeek Claude Code
  - `writer` / `artist` / `researcher` -> Qwen OpenAI-compatible

## Qwen Real Smoke Failure

Command shape:

```bash
CARVIS_QWEN_REAL_SMOKE=1 npm run provider:smoke
```

Observed error from DashScope-compatible endpoints:

```text
invalid_api_key
Incorrect API key provided
```

## Tested Base URLs

All of these failed with the current Qwen credential:

```text
https://dashscope.aliyuncs.com/compatible-mode/v1
https://coding.dashscope.aliyuncs.com/v1
https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
https://trial.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
https://dashscope-intl.aliyuncs.com/compatible-mode/v1
https://dashscope-intl.aliyuncs.com/api/v1
```

ModelScope endpoint check:

```text
https://api-inference.modelscope.cn/v1/models
```

The model list endpoint responded, but `/chat/completions` failed authentication with the current credential.

## Current Conclusion

This is not currently a Carvis routing bug. The Qwen code path exists and dry route smoke passes, but real Qwen production is blocked by credential or endpoint mismatch.

Most likely causes:

- The provided Qwen key is not a valid DashScope API key for OpenAI-compatible chat completions.
- The key belongs to a workspace that requires a different `QWEN_OPENAI_BASE_URL`.
- The key is expired, disabled, or scoped for a different API product.
- The requested model name is not enabled for that account or endpoint.

## Needed To Continue

Provide one of the following:

1. A valid DashScope API key that works with:

```text
https://dashscope.aliyuncs.com/compatible-mode/v1
```

2. The correct Workspace ID and matching base URL:

```text
https://<WORKSPACE_ID>.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
```

3. A confirmed Qwen-compatible provider endpoint and model id for the current key.

After that, rerun:

```bash
CARVIS_QWEN_REAL_SMOKE=1 npm run provider:smoke
```

Then enable full real provider runtime only after Qwen passes:

```bash
CARVIS_AGENTRUNTIME_REAL_PROVIDERS=1
```
