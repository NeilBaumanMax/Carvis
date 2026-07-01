# 00 Setup Progress

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
