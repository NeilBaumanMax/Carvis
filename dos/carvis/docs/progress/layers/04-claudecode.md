# 04 ClaudeCode Progress

## 2026-07-04 / Phase 5 / 开工计划

### 当前目标

- 实现 Claude Code CLI PID Agent 真实封装。

### 计划改动

- 新增 `src/agentruntime/claudecode/agent.ts`。
- 使用 `child_process.spawn` 启动 `claude`，通过 DeepSeek Anthropic 兼容环境变量注入。
- 支持 stdout/stderr 捕获、超时、非零退出码分类和 messagebus 流式输出。

### 验收指标

- `npm run claudecode:smoke` 通过。
- mock claude 命令可被启动并捕获输出。
- 真实模式通过 `CARVIS_CLAUDE_MODE=real` 显式启用。

### 本次完成

- 新增 `src/agentruntime/claudecode/agent.ts`。
- 支持 `child_process.spawn` 启动 CLI、stdin 写 prompt、stdout/stderr 收集。
- 支持 `CARVIS_AGENT_TIMEOUT_MS`，默认 300000 ms。
- 支持 `agent.output.stream` 广播。
- 真实默认 `claude` 命令缺少 `ANTHROPIC_AUTH_TOKEN` 时给出明确配置错误。

### 验证结果

- `npm run claudecode:smoke`：通过，使用 mock Node 子进程。
- 真实模式未运行，原因：当前未提供真实 DeepSeek token。

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
