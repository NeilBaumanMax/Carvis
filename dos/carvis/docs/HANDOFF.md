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

## 2026-07-02 / 1000x640 centered Electron + Chinese agent output + game preview / 接力记录

### 当前状态

- Electron 已改为默认 `1000x640` 居中窗口，不再默认 fullscreen/kiosk，避免 1280x720 屏幕边缘截断。
- 1000px 宽度下五个 agent 框保持一行，全部同屏露出；截图证据为本地 `/tmp/carvis-1000x640-window.png`。
- 五个 agent 框会追加显示最近 80 行公开进度输出。
- 常驻 runtime 会发布中文化 `>>> LIVE CLI STREAM [...]` 公开进度，并按五个中文人设输出实际 RPG 设计内容预览。
- renderer 重绘后会自动滚动 agent 日志和 output 预览到底部。
- Output 区显示整个 output 产物文件夹预览：folder、final report、manifest、五个 role result 和 final report 预览。
- Output 现在还会生成 `game-preview.html`；Electron 支持用 `CARVIS_GAME_PREVIEW_BROWSER_CMD` 指定 Chrome/Chromium wrapper 自动打开。
- NixOS 已安装 fcitx5 中文输入法，当前会话运行 `fcitx5 -d`，默认 profile 含 `pinyin`。
- 已从真实 Electron 输入框提交《麦克白》RPG 任务，`output/final-report.md` 和 `output/game-preview.html` 已生成。
- 远端 `xprop` 复核 Carvis 窗口位置 `140,40`，对应 1280x720 屏幕上 `1000x640` 居中。
- Chromium wrapper 已启动下载 Chromium；若网络慢，先以 HTML 文件生成作为产物验收，再等 Chromium 完成下载打开。

### 未完成

- 后续如果要真正接 Claude Code API 的 token 流，需要把 SDK/CLI streaming 事件接入 `agent.output`；当前常驻 systemd runtime 显示公开进度流和结果摘要。

### 测试基线

- 本地 `npm run build`：通过。
- 本地 `npm run electron:ui-smoke`：通过。
- 本地 `npm run electron:browser-smoke`：通过。
- 本地 `npm run ipc:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `nixos-rebuild switch`：通过。
- 远端 NixOS 真实提交《麦克白》中文 RPG 任务：通过，`final-report.md` 和 `game-preview.html` 已生成。
- 远端 NixOS `npm run build`：通过。
- 远端 NixOS `carvis-electron.service` / `carvis-agentruntime.service`：active。

### 风险提醒

- 不要向用户承诺可显示 Claude Code 的隐藏思考链；只能显示公开进度/输出摘要。
- NixOS 中文输入法对当前 Electron 是否即时生效取决于进程环境，已重启 Electron 后会继承 user environment。

## 2026-07-02 / Electron live renderer IPC / 接力记录

### 当前状态

- Electron BrowserWindow 已支持 live renderer。
- Renderer 通过 preload IPC 调用 `getState`、`submitCommand`、`onState`。
- Renderer 通过 `openOutput` IPC 请求主进程打开 output 路径。
- 真实 NixOS Electron visual smoke 已验证窗口内 submit、DOM 实时更新和 output open 请求。
- NixOS `carvis-electron.service` 已重启并保持全屏：`1280x720+0+0`。
- 远端 NixOS `npm test` 和 SDK real MVP smoke 均通过。

### 本轮完成

- `src/electron/renderer.ts` 生成 preload 和 live render 脚本。
- `src/electron/browserMain.ts` 注册 IPC handler 并推送 shell state。
- `src/electron/shell.ts` 增加 state change subscription。
- `src/electron/browserVisualSmoke.ts` 增强真实窗口交互断言。

### 未完成

- 本段无阻塞项。

### 下次优先任务

1. 把 NixOS systemd 健康检查脚本化，统一检查服务、窗口、DPMS、real smoke。
2. 后续可把 output 打开失败信息回显到 renderer。

### 测试基线

- 本地 `npm test`：通过。
- 远端 NixOS `electron:visual-smoke`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke` with `CARVIS_REAL_MVP_USE_SDK=1`：通过。
- 远端 NixOS Electron systemd 全屏复核：通过。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 本轮功能提交：`759b000 backup: make electron renderer live`
- push 状态：已 push 到 `origin/backup/mvp-nixos-20260702-020835`

### 风险提醒

- 不要把 DeepSeek API key 写入仓库。

## 2026-07-02 / Claude Agent SDK warm runner + fullscreen Electron / 接力记录

### 当前状态

- 当前分支：`backup/mvp-nixos-20260702-020835`。
- 远端 NixOS：`howtion@192.168.137.59`，WiFi `kyle` 出网正常。
- Electron systemd 已运行真实 BrowserWindow runner，复核窗口为 `1280x720+0+0`。
- NixOS 屏幕休眠已关闭，`xset q` 显示 screen saver timeout `0` 且 DPMS disabled。
- Claude Code `--print` real runner 仍可用。
- 新增 Claude Agent SDK warm runner，NixOS + DeepSeek real smoke 已通过。
- `mvp:real-smoke` 可用 `CARVIS_REAL_MVP_USE_SDK=1` 切换到 SDK warm runner。

### 本轮完成

- 新增 `src/agentruntime/claudecode/warmSdk.ts`。
- 新增 `src/agentruntime/claudecode/warmSdkSmoke.ts`。
- 新增 `src/agentruntime/claudecode/warmSdkRoleRunner.ts`。
- 新增 npm script：`claudecode:sdk-smoke`。
- 新增依赖：`@anthropic-ai/claude-agent-sdk`。
- 更新 claudecode README、DEV_PROGRESS、LOG 和分层进度文档。

### 未完成

- SDK `WarmQuery` 每个 handle 只能 query 一次；当前策略是任务后重新预热下一轮，不是同一 PID 无限多轮复用。

### 下次优先任务

1. 把 Electron BrowserWindow renderer 改成实时订阅 messagebus 状态，而不是只加载静态 snapshot。
2. 给 NixOS systemd 增加一条可重复执行的健康检查脚本，统一检查服务 active、窗口全屏、DPMS disabled。
3. 若需要更强 Claude Code 保活，继续评估 SDK remote/control/background agent 能否暴露更长生命周期会话。

### 必读文档

- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/progress/layers/01-electron.md`
- `dos/carvis/docs/progress/layers/04-claudecode.md`
- `src/agentruntime/claudecode/README.md`

### 关键文件

- `src/agentruntime/claudecode/warmSdk.ts`
- `src/agentruntime/claudecode/warmSdkRoleRunner.ts`
- `src/smoke/realMvp.ts`
- `src/electron/browserWindow.ts`
- `src/electron/runBrowserMain.ts`

### 测试基线

- 本地 `npm run build`：通过。
- 本地 `npm run claudecode:sdk-smoke`：通过 dry。
- 本地 `npm test`：通过。
- 远端 NixOS `CARVIS_CLAUDECODE_SDK_REAL_SMOKE=1 ... npm run claudecode:sdk-smoke`：通过 real。
- 远端 NixOS `CARVIS_REAL_MVP_SMOKE=1 CARVIS_REAL_MVP_USE_SDK=1 ... npm run mvp:real-smoke`：通过 real。
- 远端 NixOS Electron 全屏复核：通过。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 本轮功能提交：`f6e8365 backup: add claude sdk warm runner`
- 已 push：是，`origin/backup/mvp-nixos-20260702-020835`
- 备份分支：`backup/mvp-nixos-20260702-020835`

### 风险提醒

- 不要把 DeepSeek API key 写入仓库。
- 远端 `~/carvis-remote-smoke` 是普通测试目录，不是 git 工作树；以本地仓库和 GitHub 备份分支为准。

## 2026-07-02 / Electron BrowserWindow adapter / 接力记录

### 当前状态

- Electron 层已有 `createElectronBrowserWindow()`，可把 renderer HTML snapshot 加载进真实 Electron `BrowserWindow`。
- `browserMain.ts` 是真实 Electron runtime 入口；当前 systemd 仍运行 Node shell 入口 `electron/main.ts`。
- NixOS 可用 `nixpkgs#electron` runtime，版本 `v41.7.2`。
- 真实 X11 窗口截图验收已通过，截图保存在远端 `/tmp/carvis-electron-visual-smoke/carvis-electron-visual-smoke.png`。
- `carvis-electron.service` 已切换到真实 Electron BrowserWindow runner：`node dist/electron/runBrowserMain.js`。
- 重启后 Carvis 窗口自动全屏：X11 root `1280x720`，`Carvis` 窗口 `1280x720+0+0`。
- 本地和远端 NixOS `npm test` 均通过，远端真实 `mvp:real-smoke` 也通过。

### 本轮完成

- 新增 `src/electron/browserWindow.ts`。
- 新增 `src/electron/browserMain.ts`。
- 新增 `src/electron/browserSmoke.ts`。
- 新增 `src/electron/browserVisualSmoke.ts`。
- 新增 `src/electron/runBrowserVisualSmoke.ts`。
- 新增 `src/electron/runBrowserMain.ts`。
- Electron BrowserWindow 默认 fullscreen/kiosk。
- setup/systemd 支持 `CARVIS_ELECTRON_BROWSER=1` 和 `CARVIS_ELECTRON_START_DELAY_MS=8000`。
- `npm test` 纳入 `electron:browser-smoke`。

### 未完成

- Claude Code CLI 本体尚未证明可长期交互 PID 复用。

### 下次优先任务

1. 继续验证 Claude Code CLI 长驻交互能力。
2. 若 Claude Code 不支持稳定 stdin/stdout 长驻模式，把限制写入施工文档，并固定短进程 real runner + 通用 PID Agent 池的架构。
3. 后续可把重启验收脚本化。

### 关键文件

- `src/electron/browserWindow.ts`
- `src/electron/browserMain.ts`
- `src/electron/browserSmoke.ts`
- `src/electron/browserVisualSmoke.ts`
- `src/electron/runBrowserVisualSmoke.ts`
- `src/electron/renderer.ts`
- `package.json`

### 测试基线

- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `electron:visual-smoke` with `nixpkgs#electron`：通过。
- 远端 NixOS 重启后全屏 Electron systemd 验收：通过。
- 远端 NixOS 真实 `mvp:real-smoke`：通过。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 最新提交：本轮收尾后查看 `git log -1 --oneline`
- 已 push：本轮收尾后 push 到备份分支

## 2026-07-02 / Runtime PID Agent integration / 接力记录

### 当前状态

- 当前分支：`backup/mvp-nixos-20260702-020835`。
- AgentRuntime 已可选接入 `PersistentPidAgentPool`，使用真实子进程 PID 执行五角色 task。
- `runtime-pidagent:smoke` 已在本地和远端 NixOS 通过。
- NixOS user systemd Carvis 服务仍 active；长亮服务 `carvis-keep-awake-inhibit.service` 和 `carvis-xset-keep-awake.service` 仍 active。

### 本轮完成

- `AgentRuntimeOptions` 增加 `pidAgentPool` / `pidTaskTimeoutMs`。
- Runtime role flow 会把 PID Agent 输出广播给 Electron shell。
- Runtime 收尾会统一 shutdown PID Agent pool。
- 新增 `src/smoke/runtimePidAgent.ts`。
- `npm test` 纳入 `runtime-pidagent:smoke`。

### 未完成

- Claude Code CLI 本体尚未作为长驻 stdin/stdout PID Agent 复用。
- 真实 Electron BrowserWindow 尚未建立。
- systemd status CLI 尚未封装 active/enabled 检查。

### 下次优先任务

1. 验证 Claude Code CLI 是否有稳定交互模式可长期保持 PID 并接收多轮输入。
2. 若 Claude Code 不适合长期 stdin/stdout，明确记录限制，并把 Runtime 的 `pidAgentPool` 用于可交互 worker，Claude Code 保持短进程 runner。
3. 建立真实 Electron BrowserWindow，挂载现有 renderer HTML/CSS。

### 必读文档

- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`
- `dos/carvis/docs/progress/layers/04-claudecode.md`

### 关键文件

- `src/agentruntime/runtime.ts`
- `src/agentruntime/types.ts`
- `src/agentruntime/pidagent/index.ts`
- `src/smoke/runtimePidAgent.ts`
- `package.json`

### 测试基线

- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 本地 `npm run runtime-pidagent:smoke`：通过。
- 远端 NixOS `runtime-pidagent:smoke`：通过，包含在 `npm test`。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 最新提交：本轮收尾后查看 `git log -1 --oneline`
- 已 push：本轮收尾后 push 到备份分支
- 备份分支：`backup/mvp-nixos-20260702-020835`

### 风险提醒

- 不要把 DeepSeek API key 写入仓库。
- 当前新增的是 Runtime 与通用长驻 PID 池集成，不等于 Claude Code CLI 已可长期交互复用。

## 2026-07-02 / NixOS MVP systemd / 接力记录

### 当前状态

- 当前分支：`backup/mvp-nixos-20260702-020835`。
- NixOS 主机可通过 `howtion@192.168.137.59` SSH；远端 WiFi 已连接 `kyle`，默认出网走 WiFi。
- 远端 `~/carvis-remote-smoke` 已跑通无代理 DeepSeek real MVP smoke。
- user systemd 已安装并启用 `carvis.target`，`carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service` 均 active。
- NixOS 自动关机、睡眠、屏幕休眠和熄屏已关闭；永久长亮配置已写入 `/etc/nixos/configuration.nix` 并完成 `nixos-rebuild switch`。
- 熄屏补强服务已启用：`carvis-keep-awake-inhibit.service` block `sleep:idle`，`carvis-xset-keep-awake.service` 每 30 秒重置 X11 DPMS。

### 本轮完成

- remote messagebus client 增加断线重连和订阅恢复。
- 新增 `ipc:reconnect-smoke` 并加入 `npm test`。
- `setup:spawn-smoke` 使用随机端口，避免与真实 systemd messagebus 冲突。
- setup spawn 会把组件 `environment` 传给子进程。
- 远端真实 systemd 服务已安装、enable、start，并通过 live command smoke。
- 远端当前 X11 会话 `xset q` 显示 `DPMS is Disabled`，Standby/Suspend/Off 均为 0。

### 未完成

- 真实 Electron BrowserWindow 尚未建立；当前 `electron` 仍是 Node 入口和 renderer snapshot 能力。
- 当前 Runtime role PID 仍是模拟 PID，不是真实长驻 Claude Code PID Agent。
- systemd status CLI 只检查 unit 文件安装状态，尚未封装 `systemctl --user is-active/is-enabled`。

### 下次优先任务

1. 实现真实 Claude Code PID Agent 的长驻进程、输入、输出捕获、保活和 shutdown。
2. 把 AgentRuntime role runner 从 smoke 路径接到真实 PID Agent。
3. 建立真实 Electron BrowserWindow，并接入现有 shell state。

### 必读文档

- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/00-setup.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`
- `dos/carvis/docs/progress/layers/04-claudecode.md`
- `dos/carvis/docs/progress/layers/05-pidagent.md`

### 关键文件

- `src/messagebus/ipc.ts`
- `src/smoke/ipcReconnect.ts`
- `src/setup/supervisor.ts`
- `src/setup/spawnSmoke.ts`
- `src/setup/systemdInstall.ts`
- `scripts/run-nixos-mvp-smoke.sh`
- `package.json`

### 测试基线

- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS 无代理 `mvp:real-smoke`：通过。
- 远端 NixOS user systemd live command smoke：通过。
- 远端 NixOS `carvis-keep-awake-inhibit.service`：active。
- 远端 NixOS `carvis-xset-keep-awake.service`：active。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 最新提交：本轮收尾后查看 `git log -1 --oneline`
- 已 push：本轮收尾后 push 到备份分支
- 备份分支：`backup/mvp-nixos-20260702-020835`

### 风险提醒

- 不要把 DeepSeek API key 写入任何文件或提交。
- 远端 systemd messagebus 默认占用 `45931`，测试脚本需要继续使用随机端口或先停服务。
- NixOS 上 Claude Code npm 二进制需要 `steam-run`。

## 2026-07-02 / Local MVP smoke / 接力记录

### 当前状态

- 本轮按用户要求只写本地文件，未提交、未 push。
- AgentRuntime 最小调度核心已实现，当前使用模拟 PID 池。
- Electron mock shell、messagebus、agentruntime、workplaces、output 已形成本地 e2e smoke 闭环。
- NixOS 远端 `~/carvis-remote-smoke` 已通过干净 `npm ci` 和全套 dry smoke。
- NixOS 远端真实 DeepSeek Claude Code smoke 已通过，运行方式为 `steam-run <claude binary>`。

### 本轮完成

- 新增 `agentruntime:smoke`
- 新增 `workplaces:smoke`
- 新增 `output:smoke`
- 新增 `e2e:smoke`
- 新增 `claudecode:smoke`
- 新增 `mvp:real-smoke`
- 新增 `src/agentruntime/runtime.ts`
- 新增 `src/agentruntime/workplaces`
- 新增 `src/output`
- Electron 面板可接收 Agent 生命周期并更新 status、PID、latest output。
- `mvp:real-smoke` 可显式启用五角色真实 Claude Code + DeepSeek 调用，生成 workplaces 和 output。
- 已修复真实 smoke 的上下文污染问题：Claude Code 使用 `--bare`、固定 system prompt、临时 cwd。
- 已修复真实 smoke 预算过低问题：默认 `CARVIS_REAL_MVP_MAX_BUDGET_USD` 为 `0.20`。
- 已新增 `scripts/run-nixos-mvp-smoke.sh`，远端恢复后可一键同步并运行全套 dry smoke + real MVP smoke。
- 已新增 `src/agentruntime/claudecode/roleRunner.ts`，真实 Claude Code 角色执行可被 AgentRuntime 复用。
- 已新增 setup spawn 入口和 `setup:spawn-smoke`，默认 spawn 目标现在都有对应 main 文件。
- NixOS 远端完整 dry smoke 已通过到 `e2e:smoke`。
- NixOS 远端 real MVP 在 `steam-run + --bare` 下超时；已改为远端脚本默认 `CARVIS_CLAUDE_CODE_BARE=0`，待 SSH 恢复复测。

### 未完成

- 真实 Electron 窗口和 renderer UI 尚未实现。
- 当前 Runtime 的 PID 是模拟 PID，不是真实长驻 Claude Code 子进程。
- Claude Code 已可真实调用 DeepSeek，但还没有作为五个角色 Agent 接入 Runtime。
- 五角色真实 Claude Code smoke 已在本机跑通；但本轮远端 SSH 因本机网络切换暂不可用，尚未在 NixOS 完成 real run。
- 本机已切到 `kyle`，地址为 `192.168.135.73`；`192.168.135.0/24` 未发现 NixOS SSH，`192.168.135.223` 是 Android 设备。
- `192.168.137.0/24` 当前扫描结果不可信，整段 22 端口表现为开放但 SSH kex 均被关闭。
- setup 尚未真实拉起长跑 messagebus/agentruntime/electron 进程。
- messagebus 仍是内存实现，不是跨进程 IPC/WebSocket。

### 下次优先任务

1. 恢复到能访问 NixOS 的网络后，先运行远端五角色真实 smoke：`DEEPSEEK_API_KEY=... scripts/run-nixos-mvp-smoke.sh <nixos-host>`。
2. Phase 5：实现 Claude Code PID Agent 的启动、输入、输出捕获、保活和 shutdown 接口。
3. 把 AgentRuntime 的 `roleRunner` 接到 Claude Code PID Agent，先跑单角色，再扩展到五角色。
4. 建立真实 Electron 窗口或 renderer，展示现有 `ElectronShellState`。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`
- `dos/carvis/docs/progress/layers/04-claudecode.md`
- `dos/carvis/docs/progress/layers/06-workplaces.md`
- `dos/carvis/docs/progress/layers/07-output.md`

### 关键文件

- `src/agentruntime/runtime.ts`
- `src/agentruntime/types.ts`
- `src/agentruntime/claudecode/command.ts`
- `src/agentruntime/claudecode/roleRunner.ts`
- `src/messagebus/main.ts`
- `src/agentruntime/main.ts`
- `src/electron/main.ts`
- `src/setup/spawnSmoke.ts`
- `src/agentruntime/workplaces/index.ts`
- `src/output/index.ts`
- `src/electron/shell.ts`
- `src/smoke/e2e.ts`
- `src/smoke/realMvp.ts`
- `scripts/run-nixos-mvp-smoke.sh`
- `package.json`

### 测试基线

- 本地 `npm run typecheck`：通过
- 本地 `npm run setup:smoke`：通过
- 本地 `npm run messagebus:smoke`：通过
- 本地 `npm run electron:smoke`：通过
- 本地 `npm run agentruntime:smoke`：通过
- 本地 `npm run workplaces:smoke`：通过
- 本地 `npm run output:smoke`：通过
- 本地 `npm run claudecode:smoke`：通过 dry
- 本地 `npm run e2e:smoke`：通过
- 本地 `npm run mvp:real-smoke`：通过 skip 路径
- 本地 `CARVIS_REAL_MVP_SMOKE=1 DEEPSEEK_API_KEY=... npm run mvp:real-smoke`：通过 real
- 本地 `bash -n scripts/run-nixos-mvp-smoke.sh`：通过
- 本地 `createClaudeCodeRoleRunner` 抽取后 real MVP smoke：通过 real
- 本地 `npm run setup:spawn-smoke`：通过
- 远端 NixOS dry smoke：通过到 `e2e:smoke`
- 远端 NixOS real MVP：`--bare` 模式超时，已修复配置但待复测
- 远端 NixOS 同一组 dry smoke：通过
- 远端 NixOS `claudecode:smoke` real：通过

### GitHub 状态

- 当前分支：`main`
- 本轮提交：无，用户要求只写本地文件不上传 Git
- 当前 push 状态：未 push，按用户要求不上传

### 风险提醒

- 不要把测试 API key 写入文件。
- NixOS 运行 Claude Code npm 二进制需要 `steam-run`。
- 当前 e2e 证明的是本地 MVP smoke，不等于真实多 Claude PID 长驻协作已完成。
- 当前本机网络为 `10.200.226.0/24`，之前的 NixOS 地址 `192.168.137.59` / `192.168.135.250` 暂不可用。
- 后续如果切回 `14B-2652` 或重启 NixOS，需重新确认 NixOS IP。
- NixOS 上 Claude Code 经 `steam-run` 不要默认加 `--bare`；使用脚本默认的 `CARVIS_CLAUDE_CODE_BARE=0`。

## 2026-07-01 / Phase 3 / 接力记录

### 当前状态

- Phase 3 Electron mock shell 已实现。
- `src/electron` 现在有 README、状态类型、shell、入口和 smoke test。
- Electron mock shell 默认展示 manager、writer、artist、researcher、engineer 五个 workplace 面板。
- Electron mock shell 可通过 messagebus 发布 `command.submitted`，并订阅 `runtime.heartbeat` 和 `output.ready` 更新展示状态。

### 本轮完成

- 新增 `electron:smoke`。
- 输入命令会 trim 后发送到 `agentruntime`。
- heartbeat 可更新 active/idle/retained PID 数量和 queueDepth。
- output ready 可生成可展示的 output entry。
- 已用密码 SSH 连接 `howtion@192.168.137.59`，确认远端是 NixOS，Node `v22.22.2`、npm `10.9.7`、git `2.51.2` 可用。
- 已连接远端 WiFi `kyle`，`wlan0` 地址 `192.168.135.250`，默认出网路由走 WiFi；有线 `192.168.137.59` 保留用于 SSH。
- 已同步当前工作区到远端 `~/carvis-remote-smoke`，干净 `npm ci` 后通过远端 smoke。

### 未完成

- 真实 Electron 窗口和 renderer UI 尚未实现。
- 桌面与窄窗口下的视觉重叠和文字溢出检查尚未建立。
- output 真实打开能力尚未实现。
- agentruntime 侧 messagebus client 尚未实现。

### 下次优先任务

1. Phase 4：实现 agentruntime 调度核心最小状态机。
2. 让 agentruntime 发布真实 `runtime.heartbeat` 到 messagebus。
3. 后续真实 Electron 窗口建立后做桌面与窄窗口视觉验收。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/01-electron.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`

### 关键文件

- `src/electron/shell.ts`
- `src/electron/types.ts`
- `src/electron/smoke.ts`
- `src/messagebus/bus.ts`
- `src/shared/types/events.ts`
- `package.json`

### 测试基线

- `npm run typecheck`：通过
- `npm run electron:smoke`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过
- 远端 `~/carvis-remote-smoke` 中同一组命令：通过

### GitHub 状态

- 当前分支：`main`
- 开发前基线提交：`a0f5a06aa78e286fab13de0047ccdea8ebc37b4f`
- 开发前计划提交：`ecd880e`
- 开发前备份分支：`backup/pre-phase3-electron-20260701-2343`
- 本轮主体提交：`d535c3f`
- 最终记录提交：本次收尾回写提交
- 当前 push 状态：收尾回写提交后 push 到 `main`

### 风险提醒

- 当前 Electron 是 TypeScript mock shell，不是真实窗口。
- 不要让 Electron 绕过 messagebus 直接调用 agentruntime。
- 远端当前默认出网走 WiFi，SSH 仍通过有线地址 `192.168.137.59` 最稳定。

## 2026-07-01 / Phase 2 / 接力记录

### 当前状态

- Phase 2 messagebus 事件协议已实现。
- `src/messagebus` 现在有 README、类型、内存总线、入口和 smoke test。
- mock Electron 可通过 messagebus 向 mock agentruntime 发送 `command.submitted`。
- mock agentruntime 可通过 messagebus 向 mock Electron 广播 `runtime.heartbeat`。

### 本轮完成

- messagebus 支持 `publish`、`subscribe` 和 envelope 自动补齐。
- 订阅过滤支持 `type`、`source`、`target`。
- 共享事件类型补充 command、heartbeat、agent output、output ready payload。
- 新增 `messagebus:smoke`。

### 未完成

- 真实 IPC/WebSocket 传输尚未实现，当前是内存协议版本。
- 断连错误事件尚未实现，目前无订阅时返回 `delivered: 0`。
- agentruntime 侧 messagebus client 尚未实现。
- Electron 真实入口和 UI 尚未实现。

### 下次优先任务

1. Phase 3：实现 Electron 可视化外壳的最小可运行版本。
2. 为 `src/electron` 补 README。
3. 建立 `electron:smoke`，验证输入框回车或等价 mock 能发布 `command.submitted`。
4. 让 Electron mock 订阅 `runtime.heartbeat` 并展示运行时状态。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/01-electron.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`

### 关键文件

- `src/messagebus/bus.ts`
- `src/messagebus/types.ts`
- `src/messagebus/smoke.ts`
- `src/shared/types/events.ts`
- `package.json`

### 测试基线

- `npm run typecheck`：通过
- `npm run messagebus:smoke`：通过
- `npm run setup:smoke`：通过

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase2-messagebus-20260701-2145`
- 本轮主体提交：`8b8b0c0`
- 最终记录提交：`e4debfb`
- 当前 push 状态：已 push 到 `main`

### 风险提醒

- 当前 messagebus 是内存实现，不是跨进程传输；Phase 3 可以先用 mock/内存事件验证 UI 协议，后续再替换传输层。
- 不要让 Electron 绕过 messagebus 直接调用 agentruntime。

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
- 当前 push 状态：已 push 到 `main`
- 最新远端 HEAD 以 GitHub `main` 为准

### 风险提醒

- 当前本地环境显示为 Kali，不是 NixOS。
- 用户提供了 NixOS 用户名和密码，但还没有提供目标主机地址。

## 2026-07-01 / Phase 1 / 接力记录

### 当前状态

- Phase 1 setup 启动协议已实现。
- `src/setup` 现在有类型、配置、supervisor、smoke test 和 README。
- 默认 `npm start` 使用 `plan` 模式，只模拟启动顺序，不真实拉起 Electron 或 Agent。

### 本轮完成

- setup 按顺序模拟启动 `messagebus -> agentruntime -> electron`。
- required 组件启动失败时，setup 会短路并返回 `setup.failed`。
- `setup:smoke` 覆盖成功顺序和失败短路。
- `npm run typecheck`、`npm run setup:smoke`、`npm start` 均通过。

### 未完成

- messagebus 真实事件协议尚未实现。
- Electron 真实入口尚未实现。
- agentruntime 真实入口尚未实现。
- setup 的 `spawn` 模式还没有接入真实长跑进程监督。

### 下次优先任务

1. Phase 2：实现 `src/messagebus` 事件协议。
2. 新增 `messagebus:smoke`。
3. 让 mock Electron 命令能通过 messagebus 到达 mock agentruntime。
4. 让 mock agentruntime heartbeat 能广播给 mock Electron。

### 必读文档

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/docs/WORKFLOW.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/progress/layers/02-messagebus.md`

### 关键文件

- `src/setup/supervisor.ts`
- `src/setup/config.ts`
- `src/setup/types.ts`
- `src/setup/smoke.ts`
- `package.json`

### 测试基线

- `npm run typecheck`：通过
- `npm run setup:smoke`：通过
- `npm start`：通过

### GitHub 状态

- 当前分支：`main`
- 开发前备份分支：`backup/pre-phase1-setup-20260701-203615`
- 当前施工主体提交：`2e9e925`
- 最终记录提交：`0bc9da5`
- 当前 push 状态：已 push 到 `main`
- 最新远端 HEAD 以 GitHub `main` 为准

### 风险提醒

- `spawn` 模式尚未做长期进程监督。
- Phase 2 前不要让 Electron 或 agentruntime 绕过 messagebus 直接通信。

## 2026-07-02 / MVP NixOS 验收 / 接力记录

### 当前状态

- MVP 已按当前施工文档最小口径在 NixOS 上跑通。
- 本地 `npm test` 通过。
- 远端 NixOS `npm test` 通过。
- 远端 NixOS 真实 `mvp:real-smoke` 通过，使用 DeepSeek Anthropic 兼容接口和 Claude Code CLI。
- 用户要求本地写文件、不上传 git；当前没有提交、没有 push。

### 远端环境

- NixOS 主机：`howtion@192.168.137.59`
- SSH 密码：用户已提供，日志不重复记录。
- Claude Code Linux binary 通过 `steam-run` 运行。
- NixOS 直连 DeepSeek 出口/DNS 不稳定；通过本机临时 HTTP CONNECT 代理 `192.168.137.2:18080` 可稳定完成真实 smoke。
- 完整远端命令形态：
  - `CARVIS_REMOTE_HTTPS_PROXY=http://192.168.137.2:18080 CARVIS_REMOTE_HTTP_PROXY=http://192.168.137.2:18080 ./scripts/run-nixos-mvp-smoke.sh 192.168.137.59`

### 已完成

- `npm test` 汇总本地验收命令。
- `setup:spawn-smoke` 验证 setup 可真实拉起 messagebus、agentruntime、electron 三个长跑进程入口并清理 PID。
- `e2e:smoke` 验证一条用户命令走完整链路、五角色面板可见、output manifest/final report 可见、retained PID 统一 shutdown。
- `mvp:real-smoke` 验证五角色真实 Claude Code/DeepSeek 输出被写入 workplace 并汇总进 output。
- NixOS 自动关机、系统休眠、屏幕熄屏、自动锁屏已关闭并 `nixos-rebuild switch` 生效。

### 剩余风险

- 当前 Electron 是 TypeScript shell/mock，不是真实窗口 UI。
- 当前 runtime 的 PID 池是模拟 PID；真实 Claude Code 调用在 `mvp:real-smoke` 中按角色短进程执行，尚未实现长驻 PID 和多轮输入复用。
- NixOS 到 DeepSeek 的直连网络仍不稳定；真实 smoke 依赖本机临时代理。

### 下次优先任务

1. 做真实 Electron 窗口 UI，并接入现有 shell 状态模型。
2. 把 Claude Code runner 从 print 短进程升级为长驻 PID Agent。
3. 给 NixOS 配置稳定代理或修复直连出口，去掉 smoke 对临时代理的依赖。

## 2026-07-02 / 跨进程 IPC 推进 / 接力记录

### 当前状态

- 已新增 TCP JSONL messagebus，messagebus 和 agentruntime 可作为独立 Node 进程通信。
- `ipc:smoke` 已加入 `npm test`。
- 本地 `npm test` 通过。
- NixOS 完整脚本通过：
  - `npm test`
  - `mvp:real-smoke`

### 关键文件

- `src/messagebus/ipc.ts`
- `src/messagebus/main.ts`
- `src/agentruntime/main.ts`
- `src/electron/main.ts`
- `src/smoke/ipc.ts`
- `src/shared/componentMain.ts`
- `package.json`

### 下次优先任务

1. 把 `src/electron/main.ts` 从 shell 状态模型升级为真实 Electron 窗口入口。
2. 给 TCP messagebus 增加断连错误事件、重连和更严格的协议校验。
3. 实现 Claude Code 长驻 PID Agent 和多轮输入。

## 2026-07-02 / Electron Renderer Snapshot / 接力记录

### 当前状态

- Electron 层已有 shell state 和 HTML renderer snapshot。
- `electron:ui-smoke` 已加入 `npm test`。
- 本地 `npm test` 通过。
- NixOS `npm test` 和真实 `mvp:real-smoke` 通过。

### 关键文件

- `src/electron/renderer.ts`
- `src/electron/uiSmoke.ts`
- `src/electron/main.ts`
- `src/electron/README.md`

### 下次优先任务

1. 引入真实 `electron` runtime，把 `renderer.ts` 输出挂到 `BrowserWindow`。
2. 增加截图或 DOM 级 UI 验收。
3. 把 renderer 与跨进程 messagebus 的实时状态更新合并成真实桌面交互。

## 2026-07-02 / 长驻 PID Agent 池 / 接力记录

### 当前状态

- 已新增通用长驻 PID Agent 池。
- `pidagent:smoke` 已加入 `npm test`。
- 本地 `npm test` 通过。
- NixOS `npm test` 和真实 `mvp:real-smoke` 通过。

### 关键文件

- `src/agentruntime/pidagent/index.ts`
- `src/agentruntime/pidagent/mockWorker.ts`
- `src/agentruntime/pidagent/smoke.ts`
- `package.json`

### 下次优先任务

1. 验证 Claude Code 交互/后台模式能否挂到 `PersistentPidAgentPool`。
2. 将 runtime 的模拟 PID 字段替换为真实 PID Agent pool 的 PID。
3. 保持真实 `mvp:real-smoke` 继续通过。

## 2026-07-02 / systemd unit 生成 / 接力记录

### 当前状态

- setup 层已能生成 user-level systemd units。
- `setup:systemd-smoke` 已加入 `npm test`。
- 本地 `npm test` 通过。
- NixOS `npm test` 和真实 `mvp:real-smoke` 通过。
- 真实 MVP smoke 使用 Claude Code CLI + DeepSeek API：
  - `CARVIS_CLAUDE_CODE_RUNNER=steam-run`
  - `DEEPSEEK_API_KEY` 映射到 Anthropic 兼容环境变量
  - `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`

### 关键文件

- `src/setup/systemd.ts`
- `src/setup/systemdSmoke.ts`
- `src/setup/types.ts`
- `package.json`

### 下次优先任务

1. 提供安装脚本，把生成的 unit 写入 `~/.config/systemd/user`。
2. 在 NixOS 上真实执行 `systemctl --user enable --now carvis.target` 验收。
3. 修复 NixOS 直连 DeepSeek 出口，减少对临时代理的依赖。

## 2026-07-02 / systemd unit 安装器 / 接力记录

### 当前状态

- setup 层已支持把 user systemd units 写入指定目录。
- `setup:systemd-install-smoke` 已加入 `npm test`。
- 本地 `npm test` 通过。
- NixOS `npm test` 和真实 `mvp:real-smoke` 通过。

### 关键文件

- `src/setup/systemd.ts`
- `src/setup/systemdInstallSmoke.ts`
- `package.json`

### 下次优先任务

1. 增加真实安装 CLI，目标为 `~/.config/systemd/user`。
2. 增加 uninstall/rollback 命令。
3. 在 NixOS 上人工确认后执行 `systemctl --user daemon-reload && systemctl --user enable --now carvis.target`。

## 2026-07-02 / systemd 安装 CLI / 接力记录

### 当前状态

- 已新增 `setup:systemd-install` CLI。
- 默认 dry-run；显式 `CARVIS_SYSTEMD_INSTALL_MODE=install` 才写真实 unit 目录。
- 支持 `CARVIS_SYSTEMD_INSTALL_MODE=uninstall` 删除 Carvis units。
- 本地 `npm test` 通过。
- NixOS `npm test` 和真实 `mvp:real-smoke` 通过。

### 关键文件

- `src/setup/systemdInstall.ts`
- `src/setup/systemd.ts`
- `src/setup/systemdInstallSmoke.ts`
- `package.json`

### 下次优先任务

1. 用户确认后，在 NixOS 上执行真实 install + enable/start。
2. 给真实 user service 增加状态检查 smoke。
3. 继续移除临时代理依赖。

## 2026-07-02 / GitHub 备份前状态

### 当前状态

- `setup:systemd-install` 已支持 dry-run、install、uninstall、status。
- 本地 `npm test` 通过。
- 文件扫描未发现测试 API Key 写入仓库文件。
- GitHub 备份分支已推送：`backup/mvp-nixos-20260702-020835`
- 主体备份提交：`6e68339`
- 最新备份提交：以 `origin/backup/mvp-nixos-20260702-020835` 的 HEAD 为准
- 未推送 `main`。

### 下次优先任务

1. 如需正式自启动，在 NixOS 上执行真实 install + enable/start。
2. 增加 systemctl active/enabled 状态 smoke。
3. 修复 NixOS 直连 DeepSeek 网络，减少临时代理依赖。

## 2026-07-02 / WiFi 直连状态

### 当前状态

- NixOS `wlan0` 已连接 `kyle`。
- 默认路由优先走 WiFi。
- DeepSeek 直连出口已验证。
- 无代理环境下 `mvp:real-smoke` 已通过。

### 后续注意

- 后续远端真实 smoke 可优先不设置 `CARVIS_REMOTE_HTTPS_PROXY`。
- 如果 WiFi 出口再次不稳定，再临时回退到本机代理。

## 2026-07-02 / NixOS 永久长亮状态

### 当前状态

- NixOS 已关闭熄屏并设置永久长亮。
- 当前 X11 会话验证：`DPMS is Disabled`，Screen Saver `timeout: 0`。
- 重启/重新登录后会通过以下配置再次应用：
  - `services.xserver.serverFlagsSection`
  - `/home/howtion/.config/autostart/carvis-no-screen-sleep.desktop`
  - `/home/howtion/.local/bin/carvis-no-screen-sleep`

### 回滚参考

- 可用远端备份恢复：
  - `/etc/nixos/configuration.nix.bak.codex-permanent-screen-on`
  - `/etc/nixos/configuration.nix.bak.codex-permanent-screen-on-fix`
- 恢复后执行：`sudo nixos-rebuild switch`
