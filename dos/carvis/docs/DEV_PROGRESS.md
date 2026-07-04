# Carvis Development Progress

## 2026-07-04 / launchd manual-only / 开工计划

### 本轮目标

- 完善 macOS launchd 安装与手动管理流程。
- 明确禁止开机自启动：launchd 配置不得 `RunAtLoad`，不得 `KeepAlive` 自动重启。
- 提供 install/start/stop/status/uninstall 脚本，用户手动启动 Carvis。

### 涉及层

- `00-setup`
- `docs`
- `launchd`

### 计划修改

- `launchd/com.carvis.plist`
- `scripts/launchd/*`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/00-setup.md`

### 测试计划

- `plutil -lint launchd/com.carvis.plist`
- `bash -n scripts/launchd/*.sh`
- `npm run typecheck`
- `npm run start:full:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 基线提交：`05735f5843bc8a75af0a808cae97dad989deebf1`
- 备份分支：`backup/pre-launchd-manual-only-20260704-1135`
- 远端状态：待 push 到 `origin`，不使用 `upstream`

### 回滚预案

- 优先使用 `git revert <launchd-manual-commit>` 回滚本轮提交。
- 如仅需回滚未提交文件，恢复 `launchd/com.carvis.plist` 并删除 `scripts/launchd`。

### 本次完成

- `launchd/com.carvis.plist` 已改为 `RunAtLoad=false`、`KeepAlive=false`，禁止开机自启和自动重启。
- 新增 `scripts/launchd` 手动 install/start/stop/status/uninstall 脚本。
- 新增 `macos/Carvis.app`，可像普通软件一样双击打开工程。
- 新增 `scripts/macos` 手动 open/status/stop 脚本。
- 新增 `secrets/deepseek-api-key.txt` 本地填写文件，并加入 `.gitignore`。
- 新增 `secrets/deepseek-api-key.example.txt` 作为可提交模板。
- DeepSeek 环境加载会在缺少 `ANTHROPIC_AUTH_TOKEN` 时读取本地 `secrets/deepseek-api-key.txt`。

### 当前未完成

- 还没有把 app bundle 复制到 `/Applications`。
- launchd 脚本已提供，但未实际安装到 `~/Library/LaunchAgents`。

### 下一步

1. 用户把 DeepSeek API key 填入 `secrets/deepseek-api-key.txt`。
2. 用户可双击 `macos/Carvis.app` 打开 Carvis。
3. 如需要手动 launchd 管理，可运行 `scripts/launchd/install.sh` 和 `scripts/launchd/start.sh`。

## 2026-07-04 / Phase 5-7 / 开工计划

### 本轮目标

- 将项目文档从 macOS 目标迁移为 macOS 目标，并补充 launchd User Agent 配置。
- 实现 Claude Code CLI PID Agent 的真实封装，保留 mock fallback。
- 建立 workplaces 工作隔间文件读写能力。
- 为 agentruntime 增加真实多角色协作编排入口，默认可继续用 mock 路径稳定运行。

### 涉及层

- `00-setup`
- `03-agentruntime`
- `04-claudecode`
- `06-workplaces`
- `07-output`
- `docs`

### 计划修改

- `dos/carvis/CODEX_START_HERE.md`
- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/ARCHITECTURE.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/00-setup.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`
- `dos/carvis/docs/progress/layers/04-claudecode.md`
- `dos/carvis/docs/progress/layers/06-workplaces.md`
- `dos/carvis/docs/progress/layers/07-output.md`
- `launchd/com.carvis.plist`
- `src/shared/types/events.ts`
- `src/agentruntime/claudecode/*`
- `src/agentruntime/workplaces/*`
- `src/agentruntime/runtime.ts`
- `src/agentruntime/smoke.ts`
- `package.json`
- `workplaces/*/.gitkeep`

### 测试计划

- `npm run typecheck`
- `npm run claudecode:smoke`
- `npm run workplaces:smoke`
- `npm run agentruntime:smoke`
- `npm run full:smoke`
- `npm run start:full:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 基线提交：`f3664a75b0edbe984c38f565bf57e895a75306a3`
- 备份分支：`backup/pre-macos-phase5-7-20260704-1107`
- 远端状态：待 push 到 `origin`，不使用 `upstream`

### 回滚预案

- 优先使用 `git revert <phase5-7-commit>` 回滚本轮代码和文档提交。
- 如仅需回滚未提交文件，删除本轮新增的 launchd、claudecode agent、workplaces 模块和 smoke 脚本，恢复 agentruntime mock-only 状态。

### 本次完成

- 指定核心文档已改为 macOS/launchd 目标。
- 新增 `launchd/com.carvis.plist`，作为 macOS User Agent 开机自启配置样例。
- 新增 `src/agentruntime/claudecode/agent.ts`，支持真实 Claude Code CLI 子进程启动、stdin prompt、stdout/stderr 收集、超时和 `agent.output.stream`。
- 新增 `CARVIS_CLAUDE_MODE=mock|real` 运行模式，默认 mock，真实模式需要 `ANTHROPIC_AUTH_TOKEN`。
- 新增 `workplaces/manager|writer|artist|researcher|engineer` 目录和 TypeScript 文件读写 API。
- agentruntime 新增 `runCommand`、`runRealCommand`、`writeTaskFile`、`readRoleOutput`。
- mock 编排现在也会写入 workspace 文件和 output manifest/final report。
- 新增 `claudecode:smoke`、`workplaces:smoke`、`full:smoke`。

### 当前未完成

- 真实 Claude Code CLI 模式未在本机执行，因为当前没有提供真实 `ANTHROPIC_AUTH_TOKEN`。
- Electron 窗口输入框尚未接入跨进程 messagebus。
- messagebus 仍是内存实现，尚不是真实 IPC/WebSocket。

### 下一步

1. 提供 DeepSeek API token 后运行 `CARVIS_CLAUDE_MODE=real npm run claudecode:smoke` 和真实 agentruntime smoke。
2. 把 Electron 窗口输入框接入 messagebus。
3. 将 messagebus 从内存协议推进到本地跨进程传输。

## 2026-07-04 / Phase 3+4 / 开工计划

### 本轮目标

- 解决 `npm start` 只在终端运行、用户看不到窗口的问题。
- 接入真实 Electron 依赖和可见窗口入口。
- 保持 Electron 只展示本地状态，不直接管理 PID、不绕过 messagebus 调度 Agent。

### 涉及层

- `01-electron`
- `00-setup`
- `docs`

### 计划修改

- `package.json`
- `package-lock.json`
- `src/electron/*`
- `src/setup/*`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/01-electron.md`
- `dos/carvis/docs/progress/layers/00-setup.md`

### 测试计划

- `npm run typecheck`
- `npm run electron:smoke`
- `npm run setup:smoke`
- `npm run start:full:smoke`
- `npm start`，确认出现真实 Electron 窗口

### GitHub 备份计划

- 当前分支：`main`
- 基线提交：`1e9ba54a62368079445def9783c8cf767fb1fc2b`
- 备份分支：`backup/pre-visible-electron-20260704-1029`
- 远端状态：待 push 到 `origin`，不使用 `upstream`

### 回滚预案

- 优先使用 `git revert <visible-electron-commit>` 回滚本轮代码和文档提交。
- 如仅需回滚未提交文件，移除 Electron 依赖和本轮新增窗口入口，并恢复 `electron:start` 到 mock shell。

### 本次完成

- 添加 Electron 本机依赖。
- 新增 `src/electron/windowMain.cjs` 作为真实 Electron main process。
- `npm start` 现在会打开可见 Carvis 窗口。
- 窗口包含 manager、writer、artist、researcher、engineer 五个 workplace 面板。
- 窗口底部包含输入框，按回车会在本地 demo 状态中推进角色工作流。
- `electron:mock` 保留原终端 mock shell，供 `start:full:smoke` 稳定测试使用。

### 当前未完成

- 当前窗口里的命令流仍是本地 demo，尚未接到跨进程 messagebus。
- Electron renderer 还没有拆成独立前端工程。
- Claude Code PID Agent 仍未接入。

### 下一步

1. 把 Electron 窗口输入框接到真实 messagebus `command.submitted`。
2. 让 agentruntime 订阅命令并驱动角色状态。
3. 后续接入 Claude Code CLI PID Agent。

## 2026-07-04 / Phase 4 / 开工计划

### 本轮目标

- 处理当前项目无法完整运行的问题，补齐本地完整启动需要的最小可运行进程入口。
- 让 `setup` 的 spawn 模式能够实际拉起 `messagebus`、`agentruntime` 和 Electron mock 进程。
- 新增一个面向本机运行的完整启动命令，避免用户只能看到 plan 模式。

### 涉及层

- `00-setup`
- `01-electron`
- `02-messagebus`
- `03-agentruntime`
- `docs`

### 计划修改

- `package.json`
- `.gitignore`
- `src/setup/*`
- `src/messagebus/*`
- `src/agentruntime/*`
- `src/electron/*`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/00-setup.md`
- `dos/carvis/docs/progress/layers/01-electron.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`

### 测试计划

- `npm run typecheck`
- `npm run setup:smoke`
- `npm run messagebus:smoke`
- `npm run electron:smoke`
- `npm run agentruntime:smoke`
- `npm run start:full:smoke`

### GitHub 备份计划

- 当前分支：`main`
- 基线提交：`7febca6cc283507bff1ff033ac99486bb652ec2c`
- 备份分支：`backup/pre-phase4-full-run-20260704-1019`
- 远端状态：待 push 到 `origin`，不使用 `upstream`

### 回滚预案

- 优先使用 `git revert <phase4-full-run-commit>` 回滚本轮代码和文档提交。
- 如仅需回滚未提交文件，删除本轮新增的 agentruntime/messagebus/electron 入口文件，并还原 `package.json`、`.gitignore` 和相关文档追加。

### 本次完成

- 新增 `npm start` 默认完整启动，内部执行 `npm run start:full`。
- 保留 `npm run start:plan` 作为原 plan 模式入口。
- 新增 `messagebus`、`agentruntime`、Electron mock 的本地长跑入口。
- 新增 setup spawn 模式的子进程持有和统一 shutdown 能力。
- 新增 `agentruntime:smoke`，验证最小角色顺序、heartbeat 和 output ready。
- 新增 `start:full:smoke`，验证 setup 能实际拉起并关闭三类核心进程。
- `npm start` 已实际运行成功，显示 messagebus、agentruntime、Electron mock 全部 ready。

### 当前未完成

- 当前 Electron 仍是 mock shell，不是真实窗口。
- 当前 messagebus 仍是内存协议，不是跨进程 IPC/WebSocket。
- 当前 agentruntime 仍是 mock 状态机，不启动真实 Claude Code PID Agent。

### 下一步

1. 继续 Phase 4：把 agentruntime 从 mock 状态机推进到可接收 `command.submitted` 的运行时。
2. 后续 Phase 5：接入 Claude Code CLI PID Agent 封装。
3. 后续实现真实 Electron renderer 窗口和跨进程 messagebus。

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
- 远程 SSH 调试已连接 `howtion@192.168.137.59`，确认 macOS、Node、npm、git 可用。
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
- 将 catnip 单 Agent CLI 文档模式迁移为 macOS 多进程多 Agent 可视化系统文档模式

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
- 已连接 macOS 主机：`howtion@192.168.137.59`
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
