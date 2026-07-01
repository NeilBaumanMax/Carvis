# 00 Setup Progress

## 2026-07-01 / Phase 1 / 开工计划

### 当前目标

- 建立 `src/setup` 的 TypeScript 启动协议骨架。
- 让 setup 能按顺序模拟拉起 `messagebus`、`agentruntime`、`electron`。
- 让 setup 在子进程启动失败时返回明确失败结果。

### 计划改动

- 新增 `src/setup/README.md` 说明边界。
- 新增 setup 配置类型和默认加载逻辑。
- 新增 setup supervisor，负责顺序启动和失败短路。
- 新增 `setup:smoke` 脚本验证启动顺序。

### 验收指标

- `npm run typecheck` 通过。
- `npm run setup:smoke` 通过。
- setup 不直接启动角色 Agent。
- setup 不直接调用 Claude Code CLI。

## 2026-07-01 / Phase 0 / 初始化

### 当前目标

固定 NixOS 自启动和三类核心进程拉起职责。

### 本次完成

- 明确 `src/setup` 负责拉起 `messagebus`、`agentruntime`、`electron`
- 明确 setup 不理解 Agent 业务
- 明确 setup 可加载本地环境变量，但不得写死密钥

### 当前状态

- 已完成：文档边界
- 进行中：无
- 未完成：启动脚本、systemd/user service、退出策略

### 下一步

- 补 `src/setup/README.md`
- 设计本地 smoke 启动命令
