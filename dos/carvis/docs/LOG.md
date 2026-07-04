# Carvis Construction Log

## 2026-07-04 / launchd manual-only / Mac App 启动器

### 本轮计划回放

- 完善 macOS launchd 安装与手动管理流程。
- 明确禁止开机自启动。
- 提供像普通软件一样打开 Carvis 的 macOS App 启动器。
- 提供本地 txt 文件给用户填写 DeepSeek API key。

### 本次修改

- `launchd/com.carvis.plist` 改为 `RunAtLoad=false`、`KeepAlive=false`。
- 新增 `scripts/launchd` 手动管理脚本。
- 新增 `macos/Carvis.app` 应用启动器。
- 新增 `scripts/macos` 打开、状态、停止脚本。
- 新增 `secrets/deepseek-api-key.example.txt`。
- 新增本地忽略文件 `secrets/deepseek-api-key.txt`。
- `deepseekClaudeCodeEnv.ts` 支持从本地 txt 文件读取 token。

### 修改文件

- `.gitignore`
- `launchd/com.carvis.plist`
- `macos/Carvis.app/Contents/Info.plist`
- `macos/Carvis.app/Contents/MacOS/Carvis`
- `scripts/launchd/*.sh`
- `scripts/launchd/README.md`
- `scripts/macos/*.sh`
- `scripts/macos/README.md`
- `secrets/deepseek-api-key.example.txt`
- `src/agentruntime/claudecode/deepseekClaudeCodeEnv.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/00-setup.md`

### 验证结果

- `plutil -lint launchd/com.carvis.plist macos/Carvis.app/Contents/Info.plist`：通过
- `bash -n scripts/launchd/*.sh scripts/macos/*.sh macos/Carvis.app/Contents/MacOS/Carvis`：通过
- `npm run typecheck`：通过
- `open macos/Carvis.app && sleep 15 && scripts/macos/status-carvis.sh`：通过
- `scripts/macos/stop-carvis.sh`：通过

### 测试日志

- 第 1 次：`open macos/Carvis.app && sleep 8 && scripts/macos/status-carvis.sh`，状态检查过早，报告未运行
- 复测调整：等待 15 秒后检查
- 第 2 次：`open macos/Carvis.app && sleep 15 && scripts/macos/status-carvis.sh`，通过，输出 Carvis running pid
- 第 1 次：`scripts/macos/stop-carvis.sh`，通过，停止后台 Carvis

### 测试指标判断

- 本轮涉及层：`00-setup`、macOS launcher、launchd
- 应执行测试：`plutil -lint`、`bash -n`、`npm run typecheck`、App 启动/停止验证
- 实际执行测试：全部执行
- 未执行项及原因：未安装 launchd 到 `~/Library/LaunchAgents`，因为用户明确不允许开机自启动，本轮仅提供手动安装和手动启动脚本

### GitHub 状态

- 当前分支：`main`
- 开发前基线提交：`05735f5843bc8a75af0a808cae97dad989deebf1`
- 开发前备份分支：`backup/pre-launchd-manual-only-20260704-1135`
- 本轮提交：本次收尾提交
- push 目标：`origin`
- `upstream`：只读，未修改

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <launchd-manual-commit>`
- 回滚后复测：`npm run typecheck`

### 下一步

- 用户填入 `secrets/deepseek-api-key.txt`。
- 后续接通 Electron 输入框到真实 messagebus。

## 2026-07-04 / Phase 5-7 / macOS launchd 与真实 Agent 封装

### 本轮计划回放

- 将项目目标文档从 NixOS/systemd 迁移为 macOS/launchd。
- 新增 launchd User Agent 配置。
- 实现 Claude Code CLI PID Agent 真实封装，保留 mock fallback。
- 建立 workplaces 工作隔间和 output 文件写入。
- 新增 agentruntime 真实多角色编排入口和 smoke 测试。

### 开工检查

- 已读取 `CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `docs/WORKFLOW.md`
- 已读取 `docs/TEST_METRICS.md`
- 已读取 `docs/progress/layers/03-agentruntime.md`
- 已读取 `docs/progress/layers/04-claudecode.md`
- 已读取 `docs/progress/layers/06-workplaces.md`
- 已读取 `docs/progress/layers/07-output.md`
- 当前分支：`main`
- 开发前基线提交：`f3664a75b0edbe984c38f565bf57e895a75306a3`
- 开发前计划提交：`adaa965`
- 开发前备份分支：`backup/pre-macos-phase5-7-20260704-1107`
- 远端备份状态：已 push 到 `origin`
- `upstream` 状态：用户要求只读，本轮未 push、未创建分支、未修改

### 本次修改

- 指定文档中 NixOS/systemd 目标改为 macOS/launchd。
- 新增 `launchd/com.carvis.plist`，包含 RunAtLoad、KeepAlive、WorkingDirectory、环境变量和日志路径。
- 新增 `agent.output.stream` 事件类型。
- 新增 Claude Code CLI 子进程封装。
- 新增 workplaces 文件读写模块和五个角色目录。
- agentruntime 新增 mock/real 运行模式、真实角色编排和 output 文件写入。
- 新增 `claudecode:smoke`、`workplaces:smoke`、`full:smoke`。

### 修改文件

- `dos/carvis/CODEX_START_HERE.md`
- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/ARCHITECTURE.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LAYER_CONTRACT.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/00-setup.md`
- `dos/carvis/docs/progress/layers/01-electron.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`
- `dos/carvis/docs/progress/layers/04-claudecode.md`
- `dos/carvis/docs/progress/layers/06-workplaces.md`
- `dos/carvis/docs/progress/layers/07-output.md`
- `launchd/com.carvis.plist`
- `package.json`
- `src/shared/types/events.ts`
- `src/setup/README.md`
- `src/agentruntime/runtime.ts`
- `src/agentruntime/smoke.ts`
- `src/agentruntime/fullSmoke.ts`
- `src/agentruntime/claudecode/README.md`
- `src/agentruntime/claudecode/agent.ts`
- `src/agentruntime/claudecode/smoke.ts`
- `src/agentruntime/workplaces/index.ts`
- `src/agentruntime/workplaces/smoke.ts`
- `workplaces/*/.gitkeep`

### 验证结果

- `npm run typecheck`：通过
- `npm run setup:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run electron:smoke`：通过
- `npm run claudecode:smoke`：通过
- `npm run workplaces:smoke`：通过
- `npm run agentruntime:smoke`：通过
- `npm run full:smoke`：通过
- `npm run start:full:smoke`：通过
- `npm start`：通过，真实 Electron 窗口 ready-to-show 并 html loaded
- `CARVIS_CLAUDE_MODE=real`：未运行，原因是当前未提供真实 `ANTHROPIC_AUTH_TOKEN`

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run claudecode:smoke`，通过，mock Node 子进程输出被捕获并通过 `agent.output.stream` 广播
- 第 1 次：`npm run workplaces:smoke`，通过，临时目录内写读 role output 成功
- 第 1 次：`npm run agentruntime:smoke`，通过，mock/real 开关默认 mock，角色最终 retained
- 第 1 次：并行执行 `npm run full:smoke`，失败，错误为并行 `npm run build` 造成 `dist` 导出竞争
- 失败修复：改为单独复测 `npm run full:smoke`
- 第 2 次：`npm run full:smoke`，通过，写入 final report 和 manifest
- 第 1 次：`npm run start:full:smoke`，通过，三类核心进程可启动并关闭
- 第 1 次：`npm start`，通过，真实 Electron 窗口启动并加载 HTML；Ctrl+C 后无残留 Carvis 子进程

### 测试指标判断

- 本轮涉及层：`00-setup`、`03-agentruntime`、`04-claudecode`、`06-workplaces`、`07-output`
- 应执行测试：`npm run typecheck`、`npm run claudecode:smoke`、`npm run workplaces:smoke`、`npm run agentruntime:smoke`、`npm run full:smoke`、`npm run start:full:smoke`
- 实际执行测试：`npm run typecheck`、`npm run setup:smoke`、`npm run messagebus:smoke`、`npm run electron:smoke`、`npm run claudecode:smoke`、`npm run workplaces:smoke`、`npm run agentruntime:smoke`、`npm run full:smoke`、`npm run start:full:smoke`、`npm start`
- 未执行项及原因：真实 Claude Code CLI 调用未执行，原因是当前未提供真实 DeepSeek `ANTHROPIC_AUTH_TOKEN`

### 文档漂移检查

- 指定核心文档已改为 macOS/launchd。
- 历史 LOG/HANDOFF 中保留过去 NixOS 远端调试记录，不改写历史事实。
- `LAYER_CONTRACT.md` 已补充 `agent.output.stream`。
- `TEST_METRICS.md` 已补充 claudecode stream 验收。

### GitHub 状态

- 当前分支：`main`
- 开发前基线提交：`f3664a75b0edbe984c38f565bf57e895a75306a3`
- 开发前计划提交：`adaa965`
- 开发前备份分支：`backup/pre-macos-phase5-7-20260704-1107`
- 本轮提交：本次收尾提交
- push 目标：`origin`
- push 状态：收尾提交后 push 到 `origin/main`
- `upstream`：只读，未修改

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <phase5-7-commit>`
- 回滚后复测：`npm run typecheck`、`npm run claudecode:smoke`、`npm run workplaces:smoke`、`npm run agentruntime:smoke`、`npm run full:smoke`

### 下一步

- 提供真实 DeepSeek token 后执行 `CARVIS_CLAUDE_MODE=real npm run claudecode:smoke`。
- 将 Electron 窗口输入框接入真实 messagebus。
- 将 messagebus 从内存协议推进到跨进程传输。

## 2026-07-04 / Phase 3+4 / Mac 可见 Electron 窗口

### 本轮计划回放

- 解决 `npm start` 后用户看不到前端窗口的问题。
- 将 Electron mock shell 接成真实可见窗口。
- 保持脚手架层边界，Electron 不直接管理 PID、不调用 Claude Code CLI。

### 开工检查

- 已读取 `CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `docs/DEV_PROGRESS.md`
- 已读取 `docs/LOG.md`
- 已读取 `docs/GITHUB_ROLLBACK.md`
- 已读取 `docs/TEST_METRICS.md`
- 已读取 `docs/WORKFLOW.md`
- 已读取 `docs/progress/layers/00-setup.md`
- 已读取 `docs/progress/layers/01-electron.md`
- 当前分支：`main`
- 开发前基线提交：`1e9ba54a62368079445def9783c8cf767fb1fc2b`
- 开发前计划提交：`f6042e2`
- 开发前备份分支：`backup/pre-visible-electron-20260704-1029`
- 远端备份状态：已 push 到 `origin`
- `upstream` 状态：用户要求只读，本轮未 push、未创建分支、未修改

### 本次修改

- 添加 Electron 依赖和 lockfile。
- 新增 `src/electron/windowMain.cjs` 作为真实 Electron main process。
- 将 `electron:start` 改为 `electron src/electron/windowMain.cjs`。
- 新增 `electron:mock` 保留原终端 mock shell。
- `start:full:smoke` 使用 `CARVIS_ELECTRON_MODE=mock`，避免自动测试弹窗卡住。
- `npm start` 现在能启动真实可见 Electron 窗口。

### 修改文件

- `package.json`
- `package-lock.json`
- `src/electron/README.md`
- `src/electron/windowMain.cjs`
- `src/setup/config.ts`
- `src/setup/fullSmoke.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/00-setup.md`
- `dos/carvis/docs/progress/layers/01-electron.md`

### 验证结果

- `npm run typecheck`：通过
- `npm run setup:smoke`：通过
- `npm run electron:smoke`：通过
- `npm run start:full:smoke`：通过
- `npx electron src/electron/windowMain.cjs`：通过，Electron main 日志显示窗口 ready-to-show 且 html loaded
- `npm start`：通过，完整启动 messagebus、agentruntime 和真实 Electron 窗口

### 测试日志

- 第 1 次：`npx electron dist/electron/windowMain.js`，失败，无主进程日志且无窗口；判断为 Electron ESM main 入口执行不稳定
- 失败修复：改用 `src/electron/windowMain.cjs` CommonJS main process
- 第 2 次：`npx electron src/electron/windowMain.cjs`，通过，输出 `[electron-window] ready to show` 和 `[electron-window] html loaded`
- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run setup:smoke`，通过
- 第 1 次：`npm run electron:smoke`，通过
- 第 1 次：`npm run start:full:smoke`，通过
- 第 1 次：`npm start`，通过，真实窗口入口执行并显示窗口日志

### 测试指标判断

- 本轮涉及层：`01-electron`、`00-setup`
- 应执行测试：`npm run typecheck`、`npm run electron:smoke`、`npm run setup:smoke`、`npm run start:full:smoke`、`npm start`
- 实际执行测试：`npm run typecheck`、`npm run electron:smoke`、`npm run setup:smoke`、`npm run start:full:smoke`、`npx electron src/electron/windowMain.cjs`、`npm start`
- 未执行项及原因：`npm test` 尚未建立；真实跨进程 UI messagebus 集成不在本轮范围

### 文档漂移检查

- `src/electron/README.md` 已更新，说明当前存在真实 Electron 窗口和 mock shell 两套入口。
- `DEV_PROGRESS.md`、`HANDOFF.md` 和涉及层进度已更新。
- `CODEX_MASTER_REQUIREMENTS.md` 层边界未被突破。

### GitHub 状态

- 当前分支：`main`
- 开发前基线提交：`1e9ba54a62368079445def9783c8cf767fb1fc2b`
- 开发前计划提交：`f6042e2`
- 开发前备份分支：`backup/pre-visible-electron-20260704-1029`
- 本轮提交：本次收尾提交
- push 目标：`origin`
- push 状态：收尾提交后 push 到 `origin/main`
- `upstream`：只读，未修改

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <visible-electron-commit>`
- 回滚后复测：`npm run typecheck`、`npm run electron:smoke`、`npm run setup:smoke`、`npm run start:full:smoke`

### 下一步

- 将 Electron 窗口输入框接入真实 messagebus。
- 让 agentruntime 订阅 `command.submitted` 并驱动运行时状态。

## 2026-07-04 / Phase 4 / 本地完整启动入口

### 本轮计划回放

- 处理当前项目无法完整运行的问题。
- 补齐本地完整启动需要的最小可运行进程入口。
- 让 setup spawn 模式能够实际拉起 `messagebus`、`agentruntime` 和 Electron mock 进程。
- 新增面向本机运行的完整启动命令。

### 开工检查

- 已读取 `CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `docs/DEV_PROGRESS.md`
- 已读取 `docs/LOG.md`
- 已读取 `docs/GITHUB_ROLLBACK.md`
- 已读取 `docs/TEST_METRICS.md`
- 已读取 `docs/WORKFLOW.md`
- 已读取 `docs/progress/layers/00-setup.md`
- 已读取 `docs/progress/layers/01-electron.md`
- 已读取 `docs/progress/layers/02-messagebus.md`
- 已读取 `docs/progress/layers/03-agentruntime.md`
- 已读取根目录 `对参考施工文档重构的要求 .txt`
- 当前分支：`main`
- 开发前基线提交：`7febca6cc283507bff1ff033ac99486bb652ec2c`
- 开发前计划提交：`0c63777`
- 开发前备份分支：`backup/pre-phase4-full-run-20260704-1019`
- 远端备份状态：已 push 到 `origin`
- `upstream` 状态：用户要求只读，本轮未 push、未创建分支、未修改

### 本次修改

- 将 `npm start` 改为默认完整本地启动。
- 新增 `npm run start:plan` 保留原 plan 模式。
- 新增 `npm run start:full`，执行 build 后以 spawn 模式启动三类核心进程并前台持有。
- 新增 `npm run start:full:smoke`，验证三类核心进程可被实际拉起并关闭。
- 新增 `npm run agentruntime:smoke`。
- 新增 messagebus 长跑入口。
- 新增 Electron mock 长跑入口。
- 新增 agentruntime 最小状态机、heartbeat、长跑入口和 smoke test。
- setup spawn 模式现在会保存子进程引用，并在前台完整启动退出时统一 shutdown。
- `.gitignore` 新增 `.DS_Store`，避免 macOS 系统文件污染 git 状态。

### 修改文件

- `.gitignore`
- `package.json`
- `src/bootstrap.ts`
- `src/setup/types.ts`
- `src/setup/supervisor.ts`
- `src/setup/index.ts`
- `src/setup/smoke.ts`
- `src/setup/fullSmoke.ts`
- `src/shared/process/lifecycle.ts`
- `src/messagebus/main.ts`
- `src/electron/main.ts`
- `src/agentruntime/README.md`
- `src/agentruntime/types.ts`
- `src/agentruntime/runtime.ts`
- `src/agentruntime/index.ts`
- `src/agentruntime/main.ts`
- `src/agentruntime/smoke.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/00-setup.md`
- `dos/carvis/docs/progress/layers/01-electron.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`

### 验证结果

- `npm run typecheck`：通过
- `npm run setup:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run electron:smoke`：通过
- `npm run agentruntime:smoke`：通过
- `npm run start:full:smoke`：通过
- `npm start`：通过，前台启动 messagebus、agentruntime、Electron mock，并可 Ctrl+C 停止
- `ps -axo pid,command | rg 'dist/(messagebus|agentruntime|electron)/main|electron:start|Carvis'`：通过，停止后无残留 Carvis 子进程

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run setup:smoke`，通过，输出 `[setup:smoke] ok`
- 第 1 次：`npm run messagebus:smoke`，通过，输出 `[messagebus:smoke] ok`
- 第 1 次：`npm run electron:smoke`，通过，输出 `[electron:smoke] ok`
- 第 1 次：`npm run agentruntime:smoke`，通过，输出 `[agentruntime:smoke] ok`
- 第 1 次：`npm run start:full:smoke`，通过，输出 messagebus、agentruntime、Electron mock ready，并统一 SIGTERM shutdown
- 第 1 次：`npm start`，通过，输出 `Full startup is running. Press Ctrl+C to stop.`
- 停止检查：Ctrl+C 后运行 `ps` 检查，无残留 Carvis 子进程

### 测试指标判断

- 本轮涉及层：`00-setup`、`01-electron`、`02-messagebus`、`03-agentruntime`
- 应执行测试：`npm run typecheck`、`npm run setup:smoke`、`npm run messagebus:smoke`、`npm run electron:smoke`、`npm run agentruntime:smoke`、`npm run start:full:smoke`
- 实际执行测试：`npm run typecheck`、`npm run setup:smoke`、`npm run messagebus:smoke`、`npm run electron:smoke`、`npm run agentruntime:smoke`、`npm run start:full:smoke`、`npm start`
- 未执行项及原因：`npm test` 尚未建立；真实 Electron 窗口和真实 Claude Code PID Agent 尚未进入本轮实现范围

### 文档漂移检查

- `WORKFLOW.md` 的施工闭环已按本轮执行。
- `TEST_METRICS.md` 的 Phase 4 最低测试已新增并执行 `agentruntime:smoke`。
- 当前 `npm start` 默认行为已从 plan 模式改为完整本地启动，`start:plan` 保留原 plan 模式。
- `CODEX_MASTER_REQUIREMENTS.md` 的层边界未被突破：Electron 不直接管理 PID，messagebus 不执行任务，agentruntime 负责 runtime 状态和 heartbeat。

### GitHub 状态

- 当前分支：`main`
- 开发前基线提交：`7febca6cc283507bff1ff033ac99486bb652ec2c`
- 开发前计划提交：`0c63777`
- 开发前备份分支：`backup/pre-phase4-full-run-20260704-1019`
- 本轮提交：本次收尾提交
- push 目标：`origin`
- push 状态：收尾提交后 push 到 `origin/main`
- `upstream`：只读，未修改

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <phase4-full-run-commit>`
- 回滚后复测：`npm run typecheck`、`npm run setup:smoke`、`npm run messagebus:smoke`、`npm run electron:smoke`、`npm run agentruntime:smoke`、`npm run start:full:smoke`

### 下一步

- 继续 Phase 4：让 agentruntime 通过真实 messagebus 接收 `command.submitted` 并推进运行状态。
- Phase 5：接入 Claude Code CLI PID Agent 封装。
- 后续实现真实 Electron renderer 窗口和跨进程 messagebus。

## 2026-07-01 / Phase 3 / Electron 可视化外壳

### 本轮计划回放

- 完成 `src/electron` 可视化外壳的最小可运行版本。
- 建立五个 workplace 面板状态模型：manager、writer、artist、researcher、engineer。
- Electron mock shell 通过 messagebus 发布 `command.submitted`，订阅 `runtime.heartbeat` 和 `output.ready`。
- 建立 `electron:smoke`。

### 开工检查

- 已读取 `CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `docs/DEV_PROGRESS.md`
- 已读取 `docs/LOG.md`
- 已读取 `docs/GITHUB_ROLLBACK.md`
- 已读取 `docs/TEST_METRICS.md`
- 已读取 `docs/WORKFLOW.md`
- 已读取 `docs/CONSTRUCTION_PLAN.md`
- 已读取 `docs/progress/layers/01-electron.md`
- 已读取 `docs/progress/layers/02-messagebus.md`
- 已读取根目录 `对参考施工文档重构的要求 .txt`
- 当前分支：`main`
- 开发前基线提交：`a0f5a06aa78e286fab13de0047ccdea8ebc37b4f`
- 开发前计划提交：`ecd880e`
- 开发前备份分支：`backup/pre-phase3-electron-20260701-2343`
- 远端备份状态：已 push

### 本次修改

- 新增 Electron README，固定当前职责、边界和 smoke 覆盖范围。
- 新增 Electron shell 状态模型，包含五个 workplace 面板、runtime 心跳展示、output 入口、最近事件和已提交命令。
- 新增 Electron mock shell，订阅 `runtime.heartbeat`、`output.ready`、`agent.output`，提交命令时发布 `command.submitted`。
- 新增 `electron:smoke`，验证五个隔间、命令提交、心跳展示和 output 展示。
- `package.json` 新增 `electron:smoke` 脚本。

### 修改文件

- `package.json`
- `src/electron/README.md`
- `src/electron/types.ts`
- `src/electron/shell.ts`
- `src/electron/index.ts`
- `src/electron/smoke.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/01-electron.md`

### 验证结果

- `npm run typecheck`：通过
- `npm run electron:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过
- `sshpass ... ssh howtion@192.168.137.59 'hostname; uname -a; node --version; npm --version; git --version'`：通过，远端为 NixOS，Node `v22.22.2`，npm `10.9.7`，git `2.51.2`
- 远端 WiFi：已连接 `kyle`，`wlan0` 地址 `192.168.135.250`，默认出网路由走 WiFi；有线 `enp1s0` 保留用于 SSH
- `rsync` 同步到远端 `~/carvis-remote-smoke` 并执行远端 smoke：通过，远端干净 `npm ci --ignore-scripts --no-audit --no-fund` 后，`npm run typecheck`、`npm run electron:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke` 均通过

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run electron:smoke`，通过，输出 `[electron:smoke] ok`
- 第 1 次：`npm run messagebus:smoke`，通过，输出 `[messagebus:smoke] ok`
- 第 1 次：`npm run setup:smoke`，通过，输出 `[setup:smoke] ok`
- 第 1 次远程 SSH 调试：免密认证失败，用户提供密码后连接成功，确认远端 NixOS、Node、npm、git 可用
- 第 1 次远端同步 smoke：失败，目标机重启前连接中断，未完成 `rsync` 和远端 smoke
- 第 2 次远端同步 smoke：目标机重启后连通，远端 `npm install` 卡住；终止后发现 `tsc` 命令缺失
- 失败修复：同步本地 `node_modules` 到远端 `~/carvis-remote-smoke/node_modules`
- 第 3 次远端同步 smoke：通过，远端输出 `[electron:smoke] ok`、`[messagebus:smoke] ok`、`[setup:smoke] ok`
- WiFi 调试：远端连接 `kyle`，调整 `kyle` route metric 为 `50`，确认 `ip route get 8.8.8.8` 走 `wlan0`
- npm 复测：远端 `/tmp/carvis-npm-check` 干净 `npm ci --ignore-scripts --no-audit --no-fund` 通过
- 第 4 次远端同步 smoke：远端 `~/carvis-remote-smoke` 删除 `node_modules` 和 `dist` 后干净 `npm ci`，随后 `typecheck`、`electron:smoke`、`messagebus:smoke`、`setup:smoke` 全部通过

### 测试指标判断

- 本轮涉及层：`01-electron`、`02-messagebus`
- 应执行测试：`npm run typecheck`、`npm run electron:smoke`
- 实际执行测试：`npm run typecheck`、`npm run electron:smoke`、`npm run messagebus:smoke`、`npm run setup:smoke`
- 未执行项及原因：`npm test` 尚未建立；真实 Electron 窗口尚未建立，当前 Phase 3 使用 TypeScript mock shell 验证协议和状态

### 文档漂移检查

- `CONSTRUCTION_PLAN.md` 的 Phase 3 目标与当前 mock shell 实现一致，真实窗口、响应式 UI 和 output 打开能力仍属于后续增量。
- `TEST_METRICS.md` 的 Phase 3 最低测试已满足：`npm run typecheck` 和 `npm run electron:smoke`。
- `CODEX_MASTER_REQUIREMENTS.md` 的 Electron 边界未被突破。
- 无需修改架构边界文档。

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase3-electron-20260701-2343`
- 本轮主体提交：`d535c3f`
- 最终记录提交：本次收尾回写提交
- push 状态：收尾回写提交后 push 到 `main`

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <phase3-commit>`
- 回滚后复测：`npm run typecheck`、`npm run electron:smoke`、`npm run messagebus:smoke`

### 下一步

- Phase 4：实现 agentruntime 调度核心的最小状态机和 heartbeat 发布。

## 2026-07-01 / Phase 2 / messagebus 事件协议

### 本轮计划回放

- 完成 `src/messagebus` 本地事件协议第一版。
- 建立 mock Electron 到 mock agentruntime 的 `command.submitted` 转发验证。
- 建立 mock agentruntime 到 mock Electron 的 `runtime.heartbeat` 广播验证。
- 保持 messagebus 只负责 envelope、订阅、发布和转发，不执行任务、不读写 workplace。

### 开工检查

- 已读取 `CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `docs/DEV_PROGRESS.md`
- 已读取 `docs/LOG.md`
- 已读取 `docs/GITHUB_ROLLBACK.md`
- 已读取 `docs/TEST_METRICS.md`
- 已读取 `docs/WORKFLOW.md`
- 已读取 `docs/CONSTRUCTION_PLAN.md`
- 已读取 `docs/progress/layers/02-messagebus.md`
- 已读取根目录 `对参考施工文档重构的要求 .txt`
- 当前分支：`main`
- 开发前计划提交：`edd6e14`
- 开发前备份分支：`backup/pre-phase2-messagebus-20260701-2145`
- 远端备份状态：已 push

### 本次修改

- 新增 messagebus README，固定职责和禁止事项。
- 新增内存版 messagebus，支持订阅、发布、按 `type/source/target` 过滤投递。
- 新增 envelope 自动补齐能力，生成 `eventId` 和 `timestamp`。
- 新增 command、heartbeat、agent output、output ready 的共享 payload 类型。
- 新增 `messagebus:smoke`，验证命令转发、heartbeat 广播和无订阅投递计数。
- `package.json` 新增 `messagebus:smoke` 脚本。

### 修改文件

- `package.json`
- `src/shared/types/events.ts`
- `src/messagebus/README.md`
- `src/messagebus/types.ts`
- `src/messagebus/bus.ts`
- `src/messagebus/index.ts`
- `src/messagebus/smoke.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`

### 验证结果

- `npm run typecheck`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run messagebus:smoke`，通过，输出 `[messagebus:smoke] ok`
- 第 1 次：`npm run setup:smoke`，通过，输出 `[setup:smoke] ok`
- 失败修复：无，测试未失败

### 测试指标判断

- 本轮涉及层：`02-messagebus`、`shared types`
- 应执行测试：`npm run typecheck`、`npm run messagebus:smoke`
- 实际执行测试：`npm run typecheck`、`npm run messagebus:smoke`、`npm run setup:smoke`
- 未执行项及原因：`npm test` 尚未建立，当前 Phase 2 只要求 messagebus smoke

### 文档漂移检查

- `CONSTRUCTION_PLAN.md` 的 Phase 2 目标与实际实现一致。
- `TEST_METRICS.md` 的 Phase 2 指标与实际测试一致。
- `CODEX_MASTER_REQUIREMENTS.md` 的 messagebus 边界未被突破。
- 无需修改架构边界文档。

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase2-messagebus-20260701-2145`
- 本轮主体提交：`8b8b0c0`
- 最终记录提交：`e4debfb`
- push 状态：已 push 到 `main`

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <phase2-commit>`
- 回滚后复测：`npm run typecheck`、`npm run messagebus:smoke`

### 下一步

- Phase 3：实现 Electron 可视化外壳的最小可运行版本。
- 在 Electron 输入框回车时发布 `command.submitted`。
- Electron 订阅 `runtime.heartbeat` 并显示运行时状态。

## 2026-07-01 / Phase 1 / setup 启动协议

### 本轮计划回放

- 完成 `src/setup` 第一版 TypeScript 启动协议。
- setup 按顺序模拟拉起 `messagebus`、`agentruntime`、`electron`。
- 建立 `setup:smoke`，验证启动顺序和失败短路。
- 保持 setup 只负责启动协议，不触碰 Agent 业务、workplace 或 Claude Code CLI。

### 开工检查

- 已读取 `CODEX_MASTER_REQUIREMENTS.md`
- 已读取 `docs/DEV_PROGRESS.md`
- 已读取 `docs/LOG.md`
- 已读取 `docs/GITHUB_ROLLBACK.md`
- 已读取 `docs/TEST_METRICS.md`
- 已读取 `docs/WORKFLOW.md`
- 已读取 `docs/progress/layers/00-setup.md`
- 当前分支：`main`
- 开发前计划提交：`bf86ab8`
- 开发前备份分支：`backup/pre-phase1-setup-20260701-203615`
- 远端备份状态：已 push

### 本次修改

- 新增 setup 类型定义。
- 新增 setup 配置加载。
- 新增 setup supervisor，支持 `plan` 和 `spawn` 两种模式。
- 新增可注入的 `ComponentStarter`，让启动协议和测试解耦。
- 新增 `setup:smoke`，断言成功启动顺序和 required 组件失败短路。
- `bootstrap` 接入 setup plan 模式，默认只模拟启动顺序，不真实拉起 Electron 或 Agent。
- `package.json` 新增 `setup:smoke` 脚本。

### 修改文件

- `package.json`
- `src/bootstrap.ts`
- `src/setup/README.md`
- `src/setup/config.ts`
- `src/setup/index.ts`
- `src/setup/smoke.ts`
- `src/setup/supervisor.ts`
- `src/setup/types.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/00-setup.md`

### 验证结果

- `npm run typecheck`：通过
- `npm run setup:smoke`：通过
- `npm start`：通过

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run setup:smoke`，通过，输出 `[setup:smoke] ok`
- 第 1 次：`npm start`，通过，输出启动顺序 `messagebus -> agentruntime -> electron`
- 失败修复：无，测试未失败

### 测试指标判断

- 本轮涉及层：`00-setup`
- 应执行测试：`npm run typecheck`、`npm run setup:smoke`
- 实际执行测试：`npm run typecheck`、`npm run setup:smoke`、`npm start`
- 未执行项及原因：`npm test` 尚未建立，当前 Phase 1 只要求 setup smoke

### 文档漂移检查

- `CONSTRUCTION_PLAN.md` 的 Phase 1 目标与实际实现一致。
- `TEST_METRICS.md` 的 Phase 1 指标与实际测试一致。
- `CODEX_MASTER_REQUIREMENTS.md` 的 setup 边界未被突破。
- 无需修改架构边界文档。

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase1-setup-20260701-203615`
- 本轮主体提交：`2e9e925`
- 最终记录提交：`0bc9da5`
- push 状态：已 push 到 `main`
- 最新远端 HEAD 以 GitHub `main` 为准

### 回滚判断

- 是否需要回滚：否
- 如需回滚，优先使用 `git revert <phase1-commit>`
- 回滚后复测：`npm run typecheck`、`npm run setup:smoke`

### 下一步

- Phase 2：实现 messagebus 事件协议和 `messagebus:smoke`
- 保持 Electron 和 agentruntime 通过 messagebus 解耦

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
