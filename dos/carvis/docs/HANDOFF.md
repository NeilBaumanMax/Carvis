# Carvis Handoff Document

## 目标

本文件用于每轮施工结束后，把下一位 Codex 或下一次开机继续施工所需的信息写清楚。

每次测试通过并完成文档漂移修正后，必须更新本文件。没有更新接力文档，不允许把本轮施工标记为完整完成。

## 每轮必须更新的内容

```text
## <date> / <phase> / 接力记录

### 当前状态

- <what works now>

### 本轮完成

- <completed item>

### 未完成

- <pending item>

### 下次优先任务

1. <next task>
2. <next task>

### 必读文档

- <doc path>

### 关键文件

- <file path>

### 测试基线

- `<command>`：通过

### GitHub 状态

- 当前分支：<branch>
- 最新提交：<commit>
- 已 push：是 / 否
- 备份分支：<backup branch>

### 风险提醒

- <risk>
```

## 接力质量要求

- 必须让下一次开机不靠聊天记录也能继续。
- 必须写清楚下次先做什么，不只写泛泛的“继续开发”。
- 必须写清楚哪些测试已经通过。
- 必须写清楚哪些脚本或能力还没有建立。
- 必须写清楚 GitHub 是否已经上传。

## 2026-07-01 / Phase 0 / 接力记录

### 当前状态

- `dos/carvis` 施工文档脚手架已建立。
- GitHub remote 已绑定到 `git@github.com:howtion0/carvis.git`。
- 开发前备份分支已 push：`backup/pre-carvis-bootstrap-20260701-203039`。
- GitHub SSH 已验证可用，账号为 `howtion0`。

### 本轮完成

- 固定 TypeScript、NixOS、Electron、messagebus、agentruntime、Claude Code CLI、DeepSeek 的施工边界。
- 固定 GitHub 备份、回滚、测试指标、施工闭环和接力文档规则。
- 建立基础 TypeScript 骨架和 DeepSeek Claude Code 环境变量适配。

### 未完成

- 还没有连接外部 NixOS 主机，缺少目标 IP 或 hostname。
- 子系统 smoke test 脚本尚未建立。
- Electron、messagebus、agentruntime 真实代码尚未实现。

### 下次优先任务

1. 获取 NixOS 目标机器 IP 或 hostname，验证 SSH 登录。
2. 为 `src/setup`、`src/messagebus`、`src/agentruntime`、`src/electron` 补 README。
3. 建立最小 smoke test 脚本。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/GITHUB_ROLLBACK.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`

### 关键文件

- `package.json`
- `tsconfig.json`
- `src/agentruntime/claudecode/deepseekClaudeCodeEnv.ts`
- `dos/carvis/docs/LOG.md`

### 测试基线

- `npm run typecheck`：通过

### GitHub 状态

- 当前分支：`main`
- 开发前基线提交：`868b31da3dd59f40f895cf19b98b0158b9b65ba8`
- 已 push 备份分支：是
- 备份分支：`backup/pre-carvis-bootstrap-20260701-203039`
- 当前施工主体提交：`eb657c7`
- 当前 push 状态：待最终日志回填提交后一并 push

### 风险提醒

- 当前本地环境显示为 Kali，不是 NixOS。
- 用户提供了 NixOS 用户名和密码，但还没有提供目标主机地址。
