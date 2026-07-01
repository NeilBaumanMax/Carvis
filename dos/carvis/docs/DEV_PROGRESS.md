# Carvis Development Progress

## 2026-07-02

## 2026-07-02 / Electron BrowserWindow 适配

### 本次完成

- 新增 `src/electron/browserWindow.ts`，把现有 HTML renderer snapshot 挂载到 Electron `BrowserWindow`。
- 新增 `src/electron/browserMain.ts`，供真实 Electron runtime 启动窗口时使用；现有 NixOS systemd `electron/main.ts` 入口保持不变。
- 新增 `electron:browser-smoke`，使用 fake Electron module 验证 `BrowserWindow` 参数、sandbox/webPreferences、`loadFile()` 和 `ready-to-show` 后显示窗口。
- 新增 `electron:visual-smoke`，通过外部 Electron runtime 创建真实窗口并捕获 PNG 截图。
- NixOS 上使用 `nixpkgs#electron`，确认 Electron runtime 版本 `v41.7.2`。
- `npm test` 已纳入 `electron:browser-smoke`。

### 当前验证

- 本地 `npm run typecheck`：通过
- 本地 `npm run electron:smoke`：通过
- 本地 `npm run electron:ui-smoke`：通过
- 本地 `npm run electron:browser-smoke`：通过
- 本地 `npm test`：通过
- 远端 NixOS `npm test`：通过
- 远端 NixOS `nix shell nixpkgs#electron --command npm run electron:visual-smoke`：通过，生成 `/tmp/carvis-electron-visual-smoke/carvis-electron-visual-smoke.png`
- 远端 NixOS 真实 `mvp:real-smoke`：通过

### 当前未完成

- 项目仍未把 `electron` npm 包作为依赖安装；真实窗口入口当前由 NixOS `nixpkgs#electron` 提供。
- Claude Code CLI 本体仍未证明可长期交互 PID 复用。

## 2026-07-02 / Runtime 接入长驻 PID Agent 池

### 本次完成

- AgentRuntime 新增可选 `pidAgentPool`，角色运行时可使用真实子进程 PID，而不是固定模拟 PID。
- Runtime 会把 PID Agent 输出广播为 `agent.output`，Electron shell 可看到来自 PID Agent 的最新输出。
- Runtime 收尾阶段会调用 `pidAgentPool.shutdown()`，统一关闭 retained PID Agent。
- 新增 `runtime-pidagent:smoke`，验证一条命令走 Runtime 五角色流程时会拉起真实子进程 PID、输出回传到 Electron、最终统一 shutdown。
- `npm test` 已包含 `runtime-pidagent:smoke`。

### 当前验证

- 本地 `npm run typecheck`：通过
- 本地 `npm run pidagent:smoke`：通过
- 本地 `npm run runtime-pidagent:smoke`：通过
- 本地 `npm test`：通过
- 远端 NixOS `npm test`：通过，包含 `runtime-pidagent:smoke`

### 当前未完成

- Claude Code 本体仍使用短进程 `--print` real smoke；尚未验证 Claude Code 交互模式可作为长期 stdin/stdout PID Agent 复用。
- 真实 Electron BrowserWindow 尚未建立。

## 2026-07-02 / NixOS MVP systemd + 长亮配置

### 本次完成

- remote messagebus client 增加断线重连和订阅恢复。
- 新增 `ipc:reconnect-smoke`，并纳入 `npm test`。
- setup spawn 支持组件环境变量，`setup:spawn-smoke` 改用随机 messagebus 端口，避免与真实 user systemd 服务冲突。
- NixOS 远端 WiFi `kyle` 无代理出网可直连 DeepSeek。
- NixOS 远端完成无代理 `npm test` 和真实 Claude Code + DeepSeek `mvp:real-smoke`。
- NixOS user systemd 已真实安装并启用 `carvis.target`、`carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service`。
- 通过真实 systemd messagebus 执行 live command smoke，返回 `output/final-report.md`，五个 role panel 均完成。
- NixOS 自动关机、睡眠、屏幕休眠和熄屏已关闭；`/etc/nixos/configuration.nix` 写入 X server 永不 blank/off 和 KDE autostart `xset s off -dpms` 配置。
- 用户反馈仍会熄屏后，补强启用 `carvis-keep-awake-inhibit.service` 和 `carvis-xset-keep-awake.service`；当前 X11 会话 `DPMS is Disabled`。

### 当前验证

- 本地 `npm run setup:spawn-smoke`：通过
- 本地 `npm run ipc:reconnect-smoke`：通过
- 本地 `npm test`：通过
- 远端 NixOS `npm test`：通过
- 远端 NixOS 无代理 `mvp:real-smoke`：通过
- 远端 NixOS user systemd live command smoke：通过
- 远端 NixOS `nixos-rebuild switch`：通过
- 远端 NixOS `carvis-keep-awake-inhibit.service`：active
- 远端 NixOS `carvis-xset-keep-awake.service`：active

### 当前未完成

- 真实 Electron BrowserWindow 尚未建立。
- 真实长驻 Claude Code PID Agent 尚未接入 Runtime。
- systemd status CLI 尚未封装 active/enabled 检查。

## 2026-07-02 / Local MVP smoke / 本地施工记录

### 本轮目标

- 按用户要求继续向 NixOS MVP 跑通推进。
- 本轮只写本地文件，不提交、不 push。
- 建立 agentruntime 最小调度核心、workplaces/output 文件产物和 e2e smoke。
- 在 NixOS 远端 `~/carvis-remote-smoke` 做干净安装和 smoke 验证。

### 本次完成

- 新增 `src/agentruntime` runtime、类型、README 和 `agentruntime:smoke`。
- AgentRuntime 可订阅 `command.submitted`，创建 run，按 manager -> writer/artist/researcher -> engineer 编排角色。
- AgentRuntime 会广播 `run.phase.changed`、Agent 生命周期、`runtime.heartbeat` 和 `output.ready`。
- Electron shell 已能消费 Agent 生命周期事件，更新面板 status、PID、latest output。
- 新增 `src/agentruntime/workplaces`，生成每个角色的 `input.md`、`plan.md`、`log.md`、`result.md`。
- 新增 `src/output`，生成 `final-report.md` 和 `manifest.json`。
- 新增 `e2e:smoke`，验证 Electron -> messagebus -> agentruntime -> workplaces -> output -> Electron 状态闭环。
- 新增 `claudecode:smoke`，NixOS 上通过 `steam-run` 真实调用 DeepSeek Claude Code 成功。
- 新增 `mvp:real-smoke`，可显式开启五角色真实 Claude Code + DeepSeek 调用，写入 workplaces 并生成 output。
- `mvp:real-smoke` 的 Claude Code 调用已改为 `--bare` + 固定 system prompt，并把 `DEEPSEEK_API_KEY` 同步给 `ANTHROPIC_API_KEY`，避免本地 CLAUDE 记忆污染输出。
- 新增 `scripts/run-nixos-mvp-smoke.sh`，用于 NixOS SSH 恢复后一键同步、干净安装、dry smoke 和 real MVP smoke。
- 新增 `src/agentruntime/claudecode/roleRunner.ts`，把真实 Claude Code 角色执行逻辑从 smoke 脚本抽成 Runtime 可复用 role runner。
- 新增 setup spawn 所需的 `messagebus/main.ts`、`agentruntime/main.ts`、`electron/main.ts` 和 `setup:spawn-smoke`。
- NixOS 远端完整 dry smoke 已通过到 `e2e:smoke`。
- 发现 NixOS `steam-run` + Claude Code `--bare` 会挂起，已新增 `CARVIS_CLAUDE_CODE_BARE=0` 开关，并让远端一键脚本默认关闭 bare。

### 当前验证

- 本地 `npm run typecheck`：通过
- 本地 `npm run setup:smoke`：通过
- 本地 `npm run messagebus:smoke`：通过
- 本地 `npm run electron:smoke`：通过
- 本地 `npm run agentruntime:smoke`：通过
- 本地 `npm run workplaces:smoke`：通过
- 本地 `npm run output:smoke`：通过
- 本地 `npm run claudecode:smoke`：通过 dry
- 本地 `npm run e2e:smoke`：通过
- 本地 `npm run mvp:real-smoke`：通过 skip 路径，未设置 `CARVIS_REAL_MVP_SMOKE=1` 时不会误调用 API
- 本地 `CARVIS_REAL_MVP_SMOKE=1 DEEPSEEK_API_KEY=... npm run mvp:real-smoke`：通过 real，五角色均调用 Claude Code + DeepSeek
- 远端 NixOS 干净 `npm ci` 后同一组 dry smoke：通过
- 远端 NixOS `CARVIS_CLAUDECODE_REAL_SMOKE=1 ... npm run claudecode:smoke`：通过 real
- 本地 `bash -n scripts/run-nixos-mvp-smoke.sh`：通过
- 本地抽取 `createClaudeCodeRoleRunner` 后再次执行 `CARVIS_REAL_MVP_SMOKE=1 DEEPSEEK_API_KEY=... npm run mvp:real-smoke`：通过 real
- 本地 `npm run setup:spawn-smoke`：通过
- 远端 NixOS `scripts/run-nixos-mvp-smoke.sh 192.168.137.59`：dry 阶段通过，real 阶段在 `--bare` 下超时

### 当前未完成

- 真实 Electron 窗口和 renderer UI 尚未实现。
- 当前 AgentRuntime 的 PID 池是模拟 PID，不是真实长驻 Claude Code PID。
- Claude Code 真实调用已通过 smoke，但尚未接入每个角色的运行流程。
- 五角色真实 Claude Code MVP smoke 脚本已建立，但本轮远端网络切换后 NixOS SSH 入口暂不可用，尚未完成远端 real run。
- 本机已切到 `kyle`，当前地址 `192.168.135.73`；扫描 `192.168.135.0/24` 后只发现网关、本机和一个 Android 设备 `192.168.135.223`，未发现 NixOS SSH。
- 当前网络对 `192.168.137.0/24` 的扫描返回整段 22 端口开放，结果不可信；SSH kex 阶段仍被关闭，不能作为 NixOS 可用入口。
- NixOS 入口曾短暂恢复并跑完 dry smoke，但随后 SSH 又进入 kex 阶段关闭/超时状态，尚未复测 `CARVIS_CLAUDE_CODE_BARE=0` 后的远端 real MVP。
- 真实 IPC/WebSocket 跨进程 messagebus 尚未实现，当前仍是内存总线。
- setup 尚未真实 spawn 长跑进程。

### 下一步

1. 恢复 NixOS SSH 后运行：`DEEPSEEK_API_KEY=... scripts/run-nixos-mvp-smoke.sh <nixos-host>`。
2. Phase 5：把 `claudecode` 封装升级为可启动、保活、关闭的 PID Agent。
3. 把 AgentRuntime 的模拟 role runner 替换为可选 Claude Code role runner。
4. 建立真实 Electron 窗口或本地 Web/Electron renderer，展示当前 shell state。

## 2026-07-01

## 2026-07-01 / Phase 3 / 开工计划

### 本轮目标

- 完成 Phase 3：`src/electron` 可视化外壳的最小可运行版本。
- 建立五个 workplace 面板状态模型：manager、writer、artist、researcher、engineer。
- 建立 Electron mock shell，通过 messagebus 发布 `command.submitted`，订阅 `runtime.heartbeat` 和 `output.ready` 并更新展示状态。
- 建立 `electron:smoke`，验证输入命令、心跳展示和 output 入口展示。

### 涉及层

- `01-electron`
- `02-messagebus`
- `shared types`
- `docs`

### 计划修改

- `src/electron/README.md`
- `src/electron/types.ts`
- `src/electron/shell.ts`
- `src/electron/index.ts`
- `src/electron/smoke.ts`
- `src/shared/types/events.ts`
- `package.json`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/01-electron.md`

### 测试计划

- `npm run typecheck`
- `npm run electron:smoke`
- `npm run messagebus:smoke`
- `npm run setup:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 基线提交：`a0f5a06aa78e286fab13de0047ccdea8ebc37b4f`
- 备份分支：`backup/pre-phase3-electron-20260701-2343`
- 远端状态：待 push 备份分支

### 回滚预案

- 优先使用 `git revert <phase3-commit>` 回滚本轮代码和文档提交。
- 如仅需回滚未提交文件，删除本轮新增的 `src/electron/*`，并还原 `package.json`、`src/shared/types/events.ts` 和本轮文档追加。

### 本次完成

- Phase 3 Electron mock shell 已完成。
- 新增 `src/electron` README、状态类型、shell、入口和 smoke 脚本。
- 默认状态包含 manager、writer、artist、researcher、engineer 五个隔间。
- 输入命令会发布 `command.submitted` 到 `agentruntime`。
- `runtime.heartbeat` 会更新 Electron runtime 展示状态。
- `output.ready` 会创建 output 展示入口。
- `npm run typecheck`、`npm run electron:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke` 均通过。
- 远程 SSH 调试已连接 `howtion@192.168.137.59`，确认 NixOS、Node、npm、git 可用。
- 已连接远端 WiFi `kyle`，默认出网路由走 `wlan0`，有线保留用于 SSH。
- 已同步到远端 `~/carvis-remote-smoke`，远端干净 `npm ci` 后，`npm run typecheck`、`npm run electron:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke` 均通过。

### 当前未完成

- 真实 Electron 窗口和 renderer UI 尚未实现。
- 桌面与窄窗口视觉验收尚未建立。
- output 打开真实文件的能力尚未实现。

### 下一步

1. Phase 4：实现 agentruntime 调度核心的最小状态机。
2. 让 agentruntime 通过 messagebus 发布 `runtime.heartbeat`。
3. 后续真实 Electron 窗口建立后做桌面与窄窗口视觉验收。

## 2026-07-01 / Phase 2 / 开工计划

### 本轮目标

- 完成 Phase 2：`src/messagebus` 本地事件协议第一版。
- 建立 mock Electron 到 mock agentruntime 的 `command.submitted` 转发验证。
- 建立 mock agentruntime 到 mock Electron 的 `runtime.heartbeat` 广播验证。
- 保持 messagebus 只负责 envelope、订阅、发布和转发，不执行任务、不读写 workplace。

### 涉及层

- `02-messagebus`
- `shared types`
- `docs`

### 计划修改

- `src/messagebus/README.md`
- `src/messagebus/types.ts`
- `src/messagebus/bus.ts`
- `src/messagebus/index.ts`
- `src/messagebus/smoke.ts`
- `src/shared/types/events.ts`
- `package.json`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`

### 测试计划

- `npm run typecheck`
- `npm run messagebus:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 当前基线提交：`fabbd3f`
- 计划备份分支：`backup/pre-phase2-messagebus-20260701-2145`
- 远端状态：待 push 备份分支

### 回滚预案

- 优先使用 `git revert <phase2-commit>` 回滚本轮代码和文档提交。
- 如仅需回滚未提交文件，删除本轮新增的 `src/messagebus/*`，并还原 `package.json`、`src/shared/types/events.ts` 和本轮文档追加。

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

- Phase 2 messagebus 事件协议代码完成
- 新增 `src/messagebus` README、类型、总线实现、入口和 smoke 脚本
- `command.submitted` 可从 mock Electron 转发给 mock agentruntime
- `runtime.heartbeat` 可从 mock agentruntime 广播给 mock Electron
- envelope 可自动补齐 `eventId` 和 `timestamp`
- `npm run messagebus:smoke` 通过
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
- 推送 Phase 1 开发前备份分支：`backup/pre-phase1-setup-20260701-203615`
- 已连接 NixOS 主机：`howtion@192.168.137.59`
- 创建 TypeScript 工程骨架：`package.json`、`tsconfig.json`、`src/main.ts`、`src/bootstrap.ts`
- 创建共享类型：Agent、Run、MessageBus event envelope
- 创建 `src/agentruntime/claudecode/deepseekClaudeCodeEnv.ts`
- 根据 DeepSeek 官方文档固定 Claude Code CLI 的 Anthropic 兼容环境变量
- `npm install` 通过
- `npm run typecheck` 通过
- Phase 1 setup 启动协议代码完成
- 创建 `src/setup` 类型、配置、supervisor、README、smoke 脚本
- `bootstrap` 接入 setup plan 模式
- `package.json` 新增 `setup:smoke`
- `npm run setup:smoke` 通过
- `npm start` 通过，默认 plan 模式输出启动顺序 `messagebus -> agentruntime -> electron`
- 固定 `setup / electron / messagebus / agentruntime` 四大顶层职责
- 固定 `agentruntime/claudecode / mcp / messagebus / workplaces` 子层职责
- 固定总管、文书、美术、调研、技术 Agent 的协作顺序
- 固定 PID Agent 保活和统一关闭规则
- 固定心跳主归属 `agentruntime`，传播归属 `messagebus`，展示归属 `electron`

### 未开始

- 根目录 `src/*/README.md`
- `src/agentruntime/README.md`
- `src/electron/README.md`
- Claude Code CLI 子进程真实启动
- agentruntime 调度代码
- Electron UI
- Claude Code CLI PID 封装
- DeepSeek 环境变量接入
- smoke test

### 下一步

1. Phase 3：实现 Electron 可视化外壳的最小可运行版本。
2. 为 `src/electron` 补 README。
3. 建立 `electron:smoke`，验证输入命令发布 `command.submitted`。
4. 让 Electron mock 能订阅 `runtime.heartbeat` 并展示状态。

### 备注

本文件作为实时开发进度日志持续追加，不覆盖旧记录。

## 2026-07-02 / NixOS MVP Smoke / 最新进度

### 已完成

- 已连接 NixOS 主机：`howtion@192.168.137.59`
- 已禁用 NixOS 自动关机/休眠：
  - `logind` 电源键、重启键、休眠键、合盖动作均为 `ignore`
  - `systemd.sleep` 已设置 `AllowSuspend=no`、`AllowHibernation=no`、`AllowSuspendThenHibernate=no`、`AllowHybridSleep=no`
  - KDE PowerDevil AC/Battery/LowBattery 的 idle suspend、DPMS、按键动作已关闭
- 已执行 `sudo nixos-rebuild switch`，配置切换成功
- 已确认远端 `kyle` WiFi 已连接，NixOS 直连 DeepSeek 出口不稳定，需临时通过本机代理访问
- 新增 `scripts/run-nixos-mvp-smoke.sh` 可选代理透传：
  - `CARVIS_REMOTE_HTTPS_PROXY`
  - `CARVIS_REMOTE_HTTP_PROXY`
- NixOS 完整 smoke 已通过：
  - `typecheck`
  - `setup:smoke`
  - `messagebus:smoke`
  - `electron:smoke`
  - `agentruntime:smoke`
  - `workplaces:smoke`
  - `output:smoke`
  - `claudecode:smoke` dry
  - `e2e:smoke`
  - `mvp:real-smoke` real DeepSeek/Claude Code

### 本次关键命令

- 本机临时 HTTP CONNECT 代理：`0.0.0.0:18080`
- NixOS smoke：
  - `CARVIS_REMOTE_HTTPS_PROXY=http://192.168.137.2:18080 CARVIS_REMOTE_HTTP_PROXY=http://192.168.137.2:18080 ./scripts/run-nixos-mvp-smoke.sh 192.168.137.59`

### 当前状态

- MVP smoke 已在 NixOS 上跑通。
- 本地文件已修改，未提交，未 push。
- 不记录 API key 到文档。

### 2026-07-02 复验补充

- `package.json` 已新增 `npm test` 汇总验收命令。
- 本地 `npm test`：通过。
- NixOS `npm test`：通过。
- NixOS `mvp:real-smoke`：通过。
- `scripts/run-nixos-mvp-smoke.sh` 已改为远端先执行 `npm test`，再执行真实 MVP smoke。
- NixOS 屏幕自动熄屏/锁屏已关闭：
  - `~/.config/kscreenlockerrc`：`Autolock=false`、`Timeout=0`
  - `~/.config/powerdevilrc`：AC/Battery/LowBattery 的 `DimDisplay`、`DPMSControl`、`SuspendSession` 均为 0
  - 当前 X11 会话：`xset q` 显示 `DPMS is Disabled`，Screen Saver `timeout: 0`
