# 00 Setup Progress

## 2026-07-09 / 一键启动脚本 / 当前状态

- systemd 服务和 NixOS 启动脚本已移除（保留在 backup 分支）
- macOS LaunchAgent 自启动已移除（3 个 plist 文件已删除，保留在 `backup/macos-deploy-20260709-1356` 分支）
- 手动启动方式：`./scripts/start.sh`（一键三进程启动），`./scripts/stop.sh`（停止）
- 启动顺序：messagebus (TCP 45931) → agentruntime → electron (BrowserWindow)
- 环境变量和 API Key：`start.sh` 自动从 `keys.txt` 加载（不进 Git）
- `src/setup` 模块精简为 config + supervisor + types

---

## 2026-07-09 / macOS 部署 / 历史状态

- systemd 服务和 NixOS 启动脚本已移除（保留在 backup 分支）
- macOS 上采用手动三进程启动方式
- `src/setup` 模块精简为 config + supervisor + types

---

## 2026-07-03 / NixOS readback / 当前状态

### 当前事实

- 远端 NixOS user units 位于 `/home/howtion/.config/systemd/user/`。
- `carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service` 均 active。
- `carvis-agentruntime.service` 有 drop-in：`carvis-agentruntime.service.d/override.conf`，通过 `EnvironmentFile=/home/howtion/.config/carvis/agentruntime.env` 注入本地 secret。
- 当前 unit `WantedBy=carvis.target`，单个 service 显示 disabled 是 user target 管理下的历史安装状态，不代表服务未运行。
- `carvis-electron.service` 入口为 `node dist/electron/runBrowserMain.js`，`CARVIS_ELECTRON_START_DELAY_MS=8000`。

### 当前验证

- SSH readback：通过。
- `systemctl --user status`：三个核心 service active。

## 2026-07-02 / Electron browser systemd 模式 / 本次完成

### 本次完成

- `loadSetupConfig()` 支持 `CARVIS_ELECTRON_BROWSER=1`。
- browser 模式下 `carvis-electron.service` 运行 `node dist/electron/runBrowserMain.js`，再由 Node runner 启动 NixOS Electron runtime。
- 支持 `CARVIS_ELECTRON_BIN` 和 `CARVIS_ELECTRON_START_DELAY_MS` 写入 unit 环境变量。
- NixOS 远端已安装 browser 模式 user unit，并经重启验证自动恢复。

### 测试基线

- 本地 `npm run setup:systemd-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS 重启后 `carvis.target`、`carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service` 均 active。

### 剩余风险

- systemd status CLI 仍只检查 unit 文件安装状态，尚未检查 active/enabled。

## 2026-07-02 / 真实 user systemd 启用 / 本次完成

### 本次完成

- 在 NixOS 用户目录安装真实 unit 文件到 `~/.config/systemd/user`。
- 执行 `systemctl --user enable --now carvis.target`。
- 验证以下 unit 均为 active：
  - `carvis.target`
  - `carvis-messagebus.service`
  - `carvis-agentruntime.service`
  - `carvis-electron.service`
- 通过真实 systemd messagebus 提交 live command，Electron shell 收到五角色完成状态和 `output/final-report.md`。
- `setup:spawn-smoke` 改为随机端口，避免和真实 user systemd 服务端口冲突。
- `startComponent()` 已支持把组件 `environment` 传给子进程。

### 测试基线

- 本地 `npm run setup:spawn-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS user systemd live command smoke：通过。

### 剩余风险

- systemd status CLI 当前仍偏安装状态检查，尚未封装 active/enabled 验证。
- 真实 Electron BrowserWindow 尚未接入。

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

## 2026-07-02 / NixOS MVP 验收 / 补充

### 本次完成

- 新增 `setup:spawn-smoke`，验证 setup 以 spawn 模式拉起 `messagebus -> agentruntime -> electron` 三个入口。
- `npm test` 已包含 `setup:smoke` 和 `setup:spawn-smoke`。
- NixOS 上完整执行 `npm test` 通过。

### 测试基线

- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。

### 剩余风险

- 尚未建立 NixOS systemd/user service 自启动单元。
- spawn smoke 只验证进程可启动和清理，不验证长期重启策略。

## 2026-07-02 / systemd unit 生成 / 本次完成

### 本次完成

- 新增 `src/setup/systemd.ts`。
- 新增 `setup:systemd-smoke`，验证 user-level systemd units 内容。
- 生成以下 unit：
  - `carvis-messagebus.service`
  - `carvis-agentruntime.service`
  - `carvis-electron.service`
  - `carvis.target`
- unit 中固定 messagebus -> agentruntime -> electron 依赖顺序。

### 测试基线

- 本地 `npm run setup:systemd-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- 尚未把 unit 安装到 NixOS 用户 systemd 并 enable。
- 真实 Electron runtime 尚未接入。

## 2026-07-02 / systemd unit 安装器 / 本次完成

### 本次完成

- `src/setup/systemd.ts` 新增 `installSystemdUserUnits()`。
- 新增 `setup:systemd-install-smoke`，使用临时目录验证 unit 文件实际落盘。
- `npm test` 已包含 systemd unit 生成和安装 smoke。

### 测试基线

- 本地 `npm run setup:systemd-install-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- 尚未在真实用户 systemd 目录 enable/start。
- 后续需要增加安装脚本的真实模式和卸载/回滚命令。

## 2026-07-02 / systemd 安装 CLI / 本次完成

### 本次完成

- 新增 `src/setup/systemdInstall.ts`。
- 新增 `setup:systemd-install` CLI。
- CLI 支持：
  - 默认 `dry-run`
  - `CARVIS_SYSTEMD_INSTALL_MODE=install`
  - `CARVIS_SYSTEMD_INSTALL_MODE=uninstall`
- `setup:systemd-install-smoke` 已验证 dry-run 和 uninstall。

### 测试基线

- 本地 `npm run setup:systemd-install-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- 真实 `systemctl --user enable --now carvis.target` 尚未执行。

## 2026-07-02 / systemd status CLI / 本次完成

### 本次完成

- `setup:systemd-install` 新增 `CARVIS_SYSTEMD_INSTALL_MODE=status`。
- status 模式检查 `carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service`、`carvis.target` 是否已安装。
- `setup:systemd-install-smoke` 已覆盖 dry-run/status/uninstall/status 失败路径。

### 测试基线

- 本地 `npm test`：通过。

### 剩余风险

- status 当前检查 unit 文件安装状态，不检查 systemctl active/enabled 状态。
