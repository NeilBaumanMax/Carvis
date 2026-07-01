# Carvis Construction Log

## 2026-07-01 / Phase 0 / 迁移施工文档脚手架

### 目标

按照根目录 `对参考施工文档重构的要求 .txt`，基于 `dos/catnip` 的施工文档模式，为 `carvis` 迁移一套新的施工文档脚手架。

### 开工检查

- 已读取 `对参考施工文档重构的要求 .txt`
- 已读取 `dos/catnip/CODEX_START_HERE.md`
- 已读取 `dos/catnip/CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `dos/catnip/docs/CONSTRUCTION_PLAN.md`
- 已读取 `dos/catnip/docs/ARCHITECTURE.md`
- 已读取 `dos/catnip/docs/DEV_PROGRESS.md`
- 已读取 `dos/catnip/docs/LOG.md`
- 已检查当前 `src` 目录层次
- 已确认 `参考施工文档` 目录为空
- 已初始化本地 Git 仓库
- 已绑定远端仓库：`git@github.com:howtion0/carvis.git`
- 开发前基线提交：`868b31da3dd59f40f895cf19b98b0158b9b65ba8`
- 开发前备份分支：`backup/pre-carvis-bootstrap-20260701-203039`
- 远端备份状态：已 push
- 本轮施工主体提交：`eb657c7`

### 本次修改

- 新建 `dos/carvis` 文档脚手架
- 新建 Carvis 主入口文档
- 新建 Carvis 总需求与施工主指令
- 新建架构、施工计划、进度、日志、分层约束文档
- 新建 GitHub 备份与回滚机制文档
- 新建测试指标与验收要求文档
- 新建施工工作流文档，固定开工先写计划、收尾先写日志
- 新建接力文档规范
- 将施工闭环固化为：计划 -> GitHub 备份 -> 施工 -> 施工记录 -> 测试日志 -> 失败返工复测 -> 文档漂移修正 -> 接力文档 -> 上传 GitHub
- 新建分层进度日志
- 新建 TypeScript 工程骨架
- 新建 Claude Code CLI 的 DeepSeek 官方环境变量适配模块

### 改动部分

- 文档：`dos/carvis`
- TypeScript 工程：`package.json`、`tsconfig.json`、`src/main.ts`、`src/bootstrap.ts`
- 共享类型：`src/shared/types`
- Claude Code 适配：`src/agentruntime/claudecode`
- 未修改 `dos/catnip` 参考项目

### 验证结果

- 文档文件已创建
- 已新增 TypeScript 工程骨架
- `npm install`：通过
- `npm run typecheck`：通过
- GitHub SSH：通过，账号 `howtion0`
- GitHub 开发前备份分支 push：通过

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 2 次：`npm run typecheck`，通过
- 失败修复：无，测试未失败

### GitHub 状态

- 当前分支：`main`
- 远端仓库：`git@github.com:howtion0/carvis.git`
- 开发前基线提交：`868b31da3dd59f40f895cf19b98b0158b9b65ba8`
- 开发前备份分支：`backup/pre-carvis-bootstrap-20260701-203039`
- 本轮施工主体提交：`eb657c7`
- push 状态：已 push 到 `main`
- 最新远端 HEAD 以 GitHub `main` 为准

### 测试指标判断

- 本轮涉及层：文档、TypeScript 基础骨架、Claude Code 环境适配文档
- 应执行测试：`npm run typecheck`
- 实际执行测试：`npm run typecheck`
- 未执行项及原因：子系统 smoke test 尚未建立，当前 Phase 只建立施工文档和基础骨架

### 回滚判断

- 当前已初始化 Git 仓库并绑定 GitHub remote
- 本轮具备 GitHub 开发前备份点：`backup/pre-carvis-bootstrap-20260701-203039`
- 如需回滚文档迁移，可删除 `dos/carvis`
- 如需回滚本轮误建代码骨架，可删除 `package.json`、`package-lock.json`、`tsconfig.json`、`.gitignore`、`node_modules`、`src/main.ts`、`src/bootstrap.ts`、`src/shared/types`、`src/agentruntime/claudecode/README.md`、`src/agentruntime/claudecode/deepseekClaudeCodeEnv.ts`
- 如本轮提交已进入 GitHub，可优先使用 `git revert <commit>` 回滚

### 下一步

- 补 `src/*/README.md`
- 补最小 TypeScript 类型和 messagebus smoke test
