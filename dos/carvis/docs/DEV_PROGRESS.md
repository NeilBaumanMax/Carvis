# Carvis Development Progress

## 2026-07-01

## 2026-07-01 / Phase 1 / 开工计划

### 本轮目标

- 完成 Phase 1：`setup` 启动协议的第一版可运行代码。
- 保持代码解耦、可读、简洁，按 `setup -> messagebus / agentruntime / electron` 边界开发。
- 建立 `setup:smoke`，验证本地模拟启动顺序和失败处理。

### 涉及层

- `00-setup`
- `shared config/types`
- `docs`

### 计划修改

- `src/setup/README.md`
- `src/setup/types.ts`
- `src/setup/config.ts`
- `src/setup/supervisor.ts`
- `src/setup/index.ts`
- `src/bootstrap.ts`
- `package.json`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/00-setup.md`

### 测试计划

- `npm run typecheck`
- `npm run setup:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 当前基线提交：`20c1666`
- 计划提交本轮开工计划后创建备份分支：`backup/pre-phase1-setup-<timestamp>`
- 远端状态：待 push 备份分支

### 回滚预案

- 优先使用 `git revert <phase1-commit>` 回滚本轮代码提交。
- 如果仅需回滚未提交文件，删除或还原本轮新增的 `src/setup/*` 和 `package.json` 脚本改动。

### 进行中

- 建立面向 `carvis` 的施工文档脚手架
- 将 catnip 单 Agent CLI 文档模式迁移为 NixOS 多进程多 Agent 可视化系统文档模式

### 已完成

- 读取根目录 `对参考施工文档重构的要求 .txt`
- 读取 `dos/catnip` 的主施工文档、架构文档、施工计划、进度日志、施工日志格式
- 确认 `参考施工文档` 目录当前为空
- 确认当前 `src` 目录只有结构目录，尚无源码文件
- 创建 `dos/carvis` 文档脚手架
- 创建 `docs/GITHUB_ROLLBACK.md`
- 创建 `docs/TEST_METRICS.md`
- 创建 `docs/WORKFLOW.md`
- 创建 `docs/HANDOFF.md`
- 固定每次开工先写计划、每次结束先写日志
- 固定标准闭环：计划 -> GitHub 备份 -> 施工 -> 施工记录 -> 测试日志 -> 失败返工复测 -> 文档漂移修正 -> 接力文档 -> 上传 GitHub
- 初始化本地 Git 仓库
- 绑定 GitHub remote：`git@github.com:howtion0/carvis.git`
- 推送开发前备份分支：`backup/pre-carvis-bootstrap-20260701-203039`
- 创建 TypeScript 工程骨架：`package.json`、`tsconfig.json`、`src/main.ts`、`src/bootstrap.ts`
- 创建共享类型：Agent、Run、MessageBus event envelope
- 创建 `src/agentruntime/claudecode/deepseekClaudeCodeEnv.ts`
- 根据 DeepSeek 官方文档固定 Claude Code CLI 的 Anthropic 兼容环境变量
- `npm install` 通过
- `npm run typecheck` 通过
- 固定 `setup / electron / messagebus / agentruntime` 四大顶层职责
- 固定 `agentruntime/claudecode / mcp / messagebus / workplaces` 子层职责
- 固定总管、文书、美术、调研、技术 Agent 的协作顺序
- 固定 PID Agent 保活和统一关闭规则
- 固定心跳主归属 `agentruntime`，传播归属 `messagebus`，展示归属 `electron`

### 未开始

- 根目录 `src/*/README.md`
- Claude Code CLI 子进程真实启动
- setup 启动脚本
- messagebus 事件协议代码
- agentruntime 调度代码
- Electron UI
- Claude Code CLI PID 封装
- DeepSeek 环境变量接入
- smoke test
- 连接外部 NixOS 主机，当前缺少目标 IP 或 hostname

### 下一步

1. 获取 NixOS 目标机器 IP 或 hostname，验证 SSH 登录。
2. 为 `src/setup`、`src/messagebus`、`src/agentruntime`、`src/electron` 补 README。
3. 定义 messagebus 事件 envelope 类型。
4. 定义 AgentRole、AgentStatus、RunStatus、WorkplaceState 类型。
5. 写最小 messagebus smoke test。

### 备注

本文件作为实时开发进度日志持续追加，不覆盖旧记录。
