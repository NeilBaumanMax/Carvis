# 04 ClaudeCode Progress

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
