# 00 Setup Progress

## 2026-07-01 / Phase 1 / 完成 setup 启动协议

### 当前目标

建立 setup 第一版可运行启动协议，验证 NixOS 开机后核心进程启动顺序。

### 本次完成

- 新增 `src/setup/types.ts`
- 新增 `src/setup/config.ts`
- 新增 `src/setup/supervisor.ts`
- 新增 `src/setup/index.ts`
- 新增 `src/setup/smoke.ts`
- 新增 `src/setup/README.md`
- `bootstrap` 默认以 `plan` 模式执行 setup supervisor
- `package.json` 新增 `setup:smoke`

### 当前状态

- 已完成：按顺序模拟启动 `messagebus -> agentruntime -> electron`
- 已完成：required 组件失败时短路并返回失败结果
- 已完成：setup 不直接启动角色 Agent
- 已完成：setup 不直接调用 Claude Code CLI
- 进行中：真实 NixOS systemd/user service 尚未建立
- 未完成：真实 spawn 模式的长跑进程监督、重启策略、退出清理

### 验证结果

- `npm run typecheck`：通过
- `npm run setup:smoke`：通过
- `npm start`：通过

### 风险与阻塞

- 当前 `spawn` 模式只验证子进程 spawn 成功，不负责长期健康检查。
- Electron、messagebus、agentruntime 真实入口还不存在，因此默认使用 `plan` 模式。

### 下一步

- Phase 2 建立 messagebus 事件协议和 smoke test。
- 后续再把 setup 的 `spawn` 模式接到真实子系统入口。

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
