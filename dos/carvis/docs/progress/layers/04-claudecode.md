# 04 ClaudeCode Progress

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
