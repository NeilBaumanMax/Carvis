# 04 ClaudeCode Progress

## 2026-07-02 / DeepSeek + Qwen provider split / 开工计划

### 当前目标

- DeepSeek 继续使用 Claude Code CLI 的 Anthropic 兼容接入。
- Qwen3.5-Omni-Plus 按 `QWEN3.5-OMNI-PLUS_CODEX_SETUP.md` 使用 OpenAI 兼容接口。
- manager/engineer 使用 DeepSeek；writer/artist/researcher 使用 Qwen。
- 不把 provider key 写入仓库。

### 计划改动

- 新增 Qwen OpenAI-compatible HTTP client。
- 新增 role provider 配置和 multi-provider role runner。
- DeepSeek 角色继续使用 Claude Code CLI 封装。
- NixOS user systemd 使用本地 env file 注入 secret。

### 验收指标

- Dry smoke 验证 provider 路由和 prompt 构造。
- NixOS real smoke 验证 DeepSeek 和 Qwen 至少各成功调用一次。

### 本次完成

- 新增 `src/agentruntime/provider/roles.ts`：manager/engineer 使用 DeepSeek，writer/artist/researcher 使用 Qwen。
- 新增 `src/agentruntime/provider/qwenOpenAi.ts`：通过 OpenAI-compatible `/chat/completions` 调用 Qwen3.5-Omni-Plus。
- 新增 `src/agentruntime/provider/providerWorker.ts`：长驻 PID worker，按角色 provider 调用 DeepSeek Claude Code 或 Qwen OpenAI-compatible。
- 新增 `provider:smoke`。
- systemd unit 支持 `EnvironmentFile=`，用于本地 secret 注入。

### 当前验证

- 本地 `npm run provider:smoke`：通过 dry。
- 本地 `npm test`：通过。
- 远端 NixOS `CARVIS_CLAUDECODE_REAL_SMOKE=1 npm run claudecode:smoke`：通过 real。
- 远端 NixOS Qwen real smoke：未通过，接口返回 `invalid_api_key`。
- 已确认同一 NixOS 机器通过 WiFi 访问 DeepSeek/DashScope 域名正常，失败点是 Qwen key/endpoint 鉴权。

### 剩余风险

- 需要用户提供有效 DashScope API Key，或提供该 `sk-ws-...` key 对应的正确 workspace/base URL。
- Qwen real 未通过前，不应把常驻 systemd 切成完整真实 provider 生产模式，否则 writer/artist/researcher 会失败。

## 2026-07-02 / Claude Agent SDK warm runner / 本次完成

### 本次完成

- 引入 `@anthropic-ai/claude-agent-sdk@0.3.197`。
- 新增 `ClaudeCodeWarmSdkAgent`，通过 SDK `startup()` 预热 Claude Code 子进程。
- 使用 SDK `spawnClaudeCodeProcess` 自定义 spawn，记录实际 child PID，并支持 `CARVIS_CLAUDE_CODE_RUNNER=steam-run` 包裹 NixOS 原生二进制。
- 新增 `claudecode:sdk-smoke`：
  - dry 模式只验证构建和入口；
  - real 模式验证预热 PID、真实 DeepSeek 输出、query 后重新预热。
- 新增 `createClaudeCodeWarmSdkRoleRunner`。
- `mvp:real-smoke` 支持 `CARVIS_REAL_MVP_USE_SDK=1`，可显式走 SDK warm runner。

### 关键结论

- Claude Code CLI `--print` 和 `--input-format=stream-json` 仍是 print 模式，不等同于本项目最初设想的无限多任务 stdin/stdout worker。
- SDK `WarmQuery.query()` 类型定义说明每个 warm handle 只能调用一次。
- 当前可落地策略是：每个角色在任务前保持一个已初始化的 Claude Code 子进程，任务分配时直接提交 prompt，任务结束后重新 warm 下一轮。

### 测试基线

- 本地 `npm run claudecode:sdk-smoke`：通过 dry。
- 本地 `npm test`：通过。
- 远端 NixOS `npm run claudecode:sdk-smoke`：通过 dry。
- 远端 NixOS `CARVIS_CLAUDECODE_SDK_REAL_SMOKE=1 ... npm run claudecode:sdk-smoke`：通过 real。
- 远端 NixOS `CARVIS_REAL_MVP_SMOKE=1 CARVIS_REAL_MVP_USE_SDK=1 ... npm run mvp:real-smoke`：通过 real。

### 剩余风险

- 这不是同一个 Claude Code PID 连续执行无限多轮任务；SDK warm handle 单次使用后会结束并重新预热。
- API key 仍必须只通过环境变量或本地 secret 注入，不能写入仓库。

## 2026-07-02 / Runtime PID Agent 集成基础 / 补充

### 本次完成

- AgentRuntime 已可接入通用 `PersistentPidAgentPool`，不再只能使用模拟 PID 字段。
- 新增 `runtime-pidagent:smoke`，验证 Runtime 五角色流程可使用真实长驻子进程 PID 并统一 shutdown。
- 这为后续 Claude Code 长驻 PID 接入提供 Runtime 侧接口。

### 测试基线

- 本地 `npm run runtime-pidagent:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。

### 剩余风险

- Claude Code CLI 仍通过 `runClaudeCodePrint()` 短进程执行真实 DeepSeek smoke。
- 尚未证明 Claude Code CLI 支持本项目需要的长期 stdin/stdout 多任务协议。

## 2026-07-02 / Local MVP smoke / 本次完成

### 当前目标

- 验证 NixOS 上 Claude Code CLI 通过 DeepSeek Anthropic 兼容接口可用。

### 本次完成

- 新增 `src/agentruntime/claudecode/command.ts`
- 新增 `src/agentruntime/claudecode/index.ts`
- 新增 `src/agentruntime/claudecode/smoke.ts`
- 新增 `npm run claudecode:smoke`
- `DEEPSEEK_API_KEY` 可映射到 `ANTHROPIC_AUTH_TOKEN`
- NixOS 上通过 `CARVIS_CLAUDE_CODE_RUNNER=steam-run` 运行 Claude Code npm 二进制
- 远端真实 DeepSeek Claude Code smoke 通过

### 测试基线

- 本地 `npm run claudecode:smoke`：通过 dry
- 远端 NixOS `npm run claudecode:smoke`：通过 dry
- 远端 NixOS `CARVIS_CLAUDECODE_REAL_SMOKE=1 ... npm run claudecode:smoke`：通过 real

### 未完成

- 尚未实现长驻 PID Agent。
- 尚未实现向已启动 Claude Code PID 写入多轮输入。
- 尚未将 Claude Code PID Agent 接入 Runtime 五角色流程。

## 2026-07-01 / Phase 0 / 初始化

### 当前目标

固定 Claude Code CLI PID Agent 封装边界。

### 本次完成

- 明确 `src/agentruntime/claudecode` 负责启动和管理 Claude Code CLI 子进程
- 明确 DeepSeek API 按官方 Claude Code 文档通过 Anthropic 兼容环境变量注入
- 明确封装层捕获 stdout/stderr/exit code
- 明确封装层不做任务拆解和角色调度
- 创建 `deepseekClaudeCodeEnv.ts`
- 创建 `src/agentruntime/claudecode/README.md`

### 当前状态

- 已完成：文档边界
- 进行中：无
- 未完成：CLI 参数、子进程保活、退出控制、真实 `claude` 命令调用

### 下一步

- 补 `src/agentruntime/claudecode/README.md`
- 设计最小 PID Agent 启动接口

## 2026-07-02 / NixOS MVP 验收 / 补充

### 本次完成

- 新增 `createClaudeCodeRoleRunner`，可被 `agentruntime` 五角色流程调用。
- `mvp:real-smoke` 使用 Claude Code CLI 和 DeepSeek Anthropic 兼容接口生成五角色真实输出。
- NixOS 上通过 `CARVIS_CLAUDE_CODE_RUNNER=steam-run`、`CARVIS_CLAUDE_CODE_BARE=0` 跑通。
- 远端脚本支持 `CARVIS_REMOTE_HTTPS_PROXY` / `CARVIS_REMOTE_HTTP_PROXY`，用于绕过 NixOS 当前直连 DeepSeek 不稳定问题。

### 测试基线

- 本地 `npm test`：通过 dry。
- 远端 NixOS `npm test`：通过 dry。
- 远端 NixOS `mvp:real-smoke`：通过 real。

### 剩余风险

- 仍未实现长驻 Claude Code PID、多轮 stdin 写入和 PID 复用。
- NixOS 直连 DeepSeek 出口/DNS 不稳定，真实 smoke 目前依赖临时代理。

## 2026-07-02 / PID Agent 生命周期准备 / 补充

### 本次完成

- 新增通用 `pidagent` 长驻子进程池，为后续 Claude Code 长驻 PID 接入提供生命周期基础。
- `pidagent:smoke` 验证 PID 复用、retained 和统一 shutdown。

### 测试基线

- 本地 `npm run pidagent:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- Claude Code 本身仍使用 `--print` 短进程 smoke。
- 需要单独验证 Claude Code 交互模式是否适合长驻 stdin/stdout 协议。
