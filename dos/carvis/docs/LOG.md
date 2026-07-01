# Carvis Construction Log

## 2026-07-02 / Electron BrowserWindow adapter / 本地施工

### 本轮计划回放

- 继续按施工文档补齐 MVP 缺口。
- 当前 Electron 层已有 shell state 和 HTML renderer，但尚未挂到真实 `BrowserWindow`。
- 本轮实现可选 Electron `BrowserWindow` 适配，不强制新增 Electron npm 依赖，避免破坏 NixOS dry test。

### 本次修改

- 新增 `src/electron/browserWindow.ts`。
- 新增 `src/electron/browserMain.ts`，用于真实 Electron runtime 创建窗口。
- 新增 `src/electron/browserSmoke.ts`。
- 新增 `src/electron/browserVisualSmoke.ts` 和 `src/electron/runBrowserVisualSmoke.ts`，用于真实 Electron runtime 截图验收。
- `src/electron/index.ts` 导出 BrowserWindow 适配 API。
- `package.json` 新增 `electron:browser-smoke` 和 `electron:visual-smoke`；默认 `npm test` 纳入 browser smoke，visual smoke 需要外部 Electron runtime。

### 验证结果

- 本地 `npm run typecheck`：通过。
- 本地 `npm run electron:smoke`：通过。
- 本地 `npm run electron:ui-smoke`：通过。
- 本地 `npm run electron:browser-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `nixpkgs#electron` runtime：可用，版本 `v41.7.2`。
- 远端 NixOS `npm run electron:visual-smoke` 经 `nix shell nixpkgs#electron`：通过，生成 70KB PNG 截图 `/tmp/carvis-electron-visual-smoke/carvis-electron-visual-smoke.png`。
- 远端 NixOS 真实 `mvp:real-smoke`：通过。

### 测试指标判断

- Phase 3 Electron 验收新增覆盖：真实 `BrowserWindow` 构造参数、sandbox webPreferences、加载 renderer HTML。
- 真实 Electron 二进制启动和截图验收已用 NixOS `nixpkgs#electron` 覆盖。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 本轮提交：待收尾提交。
- push 状态：待 push。

### 下一步

- 决定是否把 `electron` npm 包纳入项目依赖，或正式固定 NixOS `nixpkgs#electron` runtime。
- 继续验证 Claude Code CLI 长驻交互能力。

## 2026-07-02 / Runtime PID Agent integration / 本地施工

### 本轮计划回放

- 继续按 NixOS MVP 目标审计施工文档。
- 当前最大缺口是 Phase 5 长驻 PID Agent 未接入 Runtime。
- 本轮推进 AgentRuntime 与通用长驻 PID Agent 池的集成，不改动 API key 或真实 Claude Code 交互模式。

### 本次修改

- `AgentRuntimeOptions` 新增 `pidAgentPool` 和 `pidTaskTimeoutMs`。
- AgentRuntime 角色运行时可从 `PersistentPidAgentPool` 获取真实子进程 PID。
- PID Agent task 输出会作为 `agent.output` 经 messagebus 广播到 Electron shell。
- Runtime 正常收尾和手动 shutdown 都会统一关闭 PID Agent pool。
- 新增 `src/smoke/runtimePidAgent.ts`。
- `package.json` 新增 `runtime-pidagent:smoke`，并纳入 `npm test`。

### 验证结果

- 本地 `npm run typecheck`：通过。
- 本地 `npm run pidagent:smoke`：通过。
- 本地 `npm run runtime-pidagent:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过，确认新 smoke 在 NixOS 上可运行。
- 远端 NixOS systemd 服务和长亮服务仍为 active，默认出网路由走 WiFi `kyle`。

### 测试指标判断

- 涉及层：`03-agentruntime`、`04-claudecode`、`05-pidagent` 生命周期基础。
- Phase 4 的角色顺序、retained、统一 shutdown 继续由 `agentruntime:smoke` 覆盖。
- Phase 5 的真实 PID 生命周期由 `pidagent:smoke` 和 `runtime-pidagent:smoke` 覆盖。
- 未完成项：Claude Code CLI 本体仍未作为长驻交互进程复用。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 本轮提交：待收尾提交。
- push 状态：待 push。

### 下一步

- 验证 Claude Code CLI 是否支持适合本项目的长期交互模式；若不适合，保留短进程 runner 并把 PID Agent 抽象用于可交互 worker。
- 建立真实 Electron BrowserWindow。

## 2026-07-02 / NixOS systemd + permanent display / 本地施工

### 本次修改

- 修复 remote messagebus client 断线后不自动恢复的问题，订阅存在时会重连并重新注册订阅。
- 新增 `ipc:reconnect-smoke`，验证 agentruntime 先启动、messagebus 后启动时可自动接通。
- `setup:spawn-smoke` 改用随机 `CARVIS_MESSAGEBUS_PORT`，避免和已启用的用户 systemd messagebus 撞端口。
- setup spawn 现在会把组件级 `environment` 传给子进程。
- 在 NixOS 上安装并启用真实 user systemd units：`carvis.target`、`carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service`。
- 按用户要求关闭 NixOS 自动熄屏/屏幕休眠：NixOS 配置写入 X server blank/standby/suspend/off 全 0，并安装 KDE autostart 脚本执行 `xset s off -dpms` 和 PowerDevil/锁屏禁用配置。
- 用户反馈仍会熄屏后，补强为两个 user systemd 常驻服务：
  - `carvis-keep-awake-inhibit.service`：使用 `systemd-inhibit` block `sleep:idle`。
  - `carvis-xset-keep-awake.service`：每 30 秒对当前 X11 会话执行 `xset -dpms`、`xset s off`、`xset s noblank`。

### 验证结果

- 本地 `npm run setup:spawn-smoke`：通过。
- 本地 `npm run ipc:reconnect-smoke`：通过。
- 本地 `npm test`：通过，包含 `ipc:reconnect-smoke`。
- 远端 NixOS 走 WiFi `kyle` 出网，无代理执行 `scripts/run-nixos-mvp-smoke.sh 192.168.137.59`：通过。
- 远端 NixOS 无代理直接访问 DeepSeek API：通过连接性检查。
- 远端 NixOS `mvp:real-smoke` 使用 Claude Code + DeepSeek API：通过。
- 远端 NixOS user systemd units `enable --now carvis.target` 后，四个 unit 均为 `active`。
- 远端 NixOS 连接 systemd messagebus 后提交 live command：通过，返回 `output/final-report.md`，五个 role panel 均完成 shutdown。
- 远端 NixOS `nixos-rebuild switch`：通过。
- 远端 NixOS `/etc/nixos/configuration.nix` 已包含 `BlankTime/StandbyTime/SuspendTime/OffTime = 0` 和 `carvisNoScreenSleep` activation script。
- 远端 NixOS `carvis-keep-awake-inhibit.service` 和 `carvis-xset-keep-awake.service` 均为 `active`。
- 远端 NixOS 当前 X11 会话 `xset q` 显示 `DPMS is Disabled`，Standby/Suspend/Off 均为 0。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 本轮代码和文档准备提交到备份分支。
- 禁止写入 API key；提交前再次扫描。

## 2026-07-02 / Local MVP smoke / 本地施工

### 本轮计划回放

- 按用户目标继续推进到 NixOS MVP 跑通。
- 按用户最新要求只写本地文件，不提交、不 push。
- 补齐 AgentRuntime 调度、workplaces、output 和 e2e smoke。
- 继续验证 NixOS 上 DeepSeek Claude Code CLI 可用。

### 本次修改

- 新增 AgentRuntime 最小调度核心和 `agentruntime:smoke`。
- Electron shell 增加 Agent 生命周期订阅，更新面板 status、PID、latest output。
- 新增 workplaces 文件结构 helper 和 `workplaces:smoke`。
- 新增 output manifest/final report helper 和 `output:smoke`。
- 新增 `e2e:smoke`，真实生成临时 workplaces 和 output 产物。
- 新增 Claude Code 命令封装和 `claudecode:smoke`。
- 新增 `mvp:real-smoke`，显式开启后让五个角色逐个调用 Claude Code + DeepSeek，并生成真实 workplaces/output smoke 产物。
- 修复 `mvp:real-smoke`：Claude Code 调用增加 `--bare`、固定 system prompt、临时 cwd，避免读取本地记忆或 CLAUDE.md。
- 修复 `mvp:real-smoke`：默认预算从 `0.02` 调整为 `0.20`，避免 Claude Code 预算预估直接退出。
- 新增 `scripts/run-nixos-mvp-smoke.sh`，封装远端同步、干净 `npm ci`、全套 dry smoke 和 real MVP smoke。
- 新增 `src/agentruntime/claudecode/roleRunner.ts`，把真实 Claude Code 角色执行逻辑从 `realMvp` smoke 抽出，供 Runtime 复用。
- 新增 setup spawn 进程入口：messagebus、agentruntime、electron。
- 新增 `setup:spawn-smoke`。
- 新增 `CARVIS_CLAUDE_CODE_BARE` 开关；远端 NixOS 脚本默认关闭 bare，避免 `steam-run + --bare` 挂起。

### 修改文件

- `package.json`
- `src/shared/types/events.ts`
- `src/electron/shell.ts`
- `src/electron/smoke.ts`
- `src/agentruntime/README.md`
- `src/agentruntime/types.ts`
- `src/agentruntime/runtime.ts`
- `src/agentruntime/index.ts`
- `src/agentruntime/smoke.ts`
- `src/agentruntime/claudecode/*`
- `src/agentruntime/workplaces/*`
- `src/output/*`
- `src/smoke/e2e.ts`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/LOG.md`
- `dos/carvis/docs/progress/layers/03-agentruntime.md`
- `dos/carvis/docs/progress/layers/04-claudecode.md`
- `dos/carvis/docs/progress/layers/06-workplaces.md`
- `dos/carvis/docs/progress/layers/07-output.md`

### 验证结果

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
- 本地抽取 `createClaudeCodeRoleRunner` 后真实 `mvp:real-smoke`：通过
- 本地 `npm run setup:spawn-smoke`：通过
- 远端 NixOS dry smoke：通过
- 远端 NixOS real MVP：失败，原因是 `steam-run + --bare` 下 Claude Code 超时；已改为远端脚本默认 `CARVIS_CLAUDE_CODE_BARE=0`，但 SSH 随后不可用，待复测
- 远端 NixOS `npm ci` 后同一组 dry smoke：通过
- 远端 NixOS `CARVIS_CLAUDECODE_REAL_SMOKE=1 ... npm run claudecode:smoke`：通过 real
- 远端 NixOS `CARVIS_REAL_MVP_SMOKE=1 ... npm run mvp:real-smoke`：未运行，本机当前网络切换到 `10.200.226.0/24`，旧 NixOS 地址 SSH 不可用

### 测试日志

- 第 1 次：`npm run typecheck`，通过
- 第 1 次：`npm run agentruntime:smoke`，通过，输出 `[agentruntime:smoke] ok`
- 第 1 次：`npm run workplaces:smoke`，通过，输出 `[workplaces:smoke] ok`
- 第 1 次：`npm run output:smoke`，通过，输出 `[output:smoke] ok`
- 第 1 次：`npm run e2e:smoke`，通过，输出 `[e2e:smoke] ok`
- 第 1 次远端全套 dry smoke：通过
- 第 1 次远端真实 Claude Code smoke：通过，输出 `[claudecode:smoke] ok (real)`
- 第 1 次本地真实 MVP smoke dry/skip：通过，输出 `[mvp:real-smoke] skipped (set CARVIS_REAL_MVP_SMOKE=1)`
- 第 1 次本地真实 MVP smoke real：失败，原因是 `--max-budget-usd 0.02` 太低，Claude Code 输出 `Exceeded USD budget (0.02)`
- 第 2 次本地真实 MVP smoke real：失败，原因是 Claude Code 读取了本地上下文，未严格输出固定文本
- 失败修复：增加 `--bare`、固定 system prompt、临时 cwd，并将预算提高到 `0.20`
- 第 3 次本地真实 MVP smoke real：通过，输出 `[mvp:real-smoke] ok`
- 第 1 次远端真实 MVP smoke：失败于连接阶段，`192.168.137.59` 返回 `No route to host` / `Connection closed`，`192.168.135.250` 连接关闭
- 网络排查：本机切到 `kyle` 后地址为 `192.168.135.73`，扫描 `192.168.135.0/24` 未发现开放 SSH 的 NixOS 主机；`192.168.135.223` 扫描为 Android 设备
- 网络排查：扫描 `192.168.137.0/24` 出现整段 22 端口开放的异常结果，SSH kex 均被关闭，判断为当前网络/代理路径拦截，不是可用 NixOS sshd
- 远端执行：`scripts/run-nixos-mvp-smoke.sh 192.168.137.59` 完成同步、干净 `npm ci`、`typecheck`、`setup/messagebus/electron/agentruntime/workplaces/output/claudecode/e2e` dry smoke，随后 real MVP 在 `--bare` 模式超时
- 失败修复：新增 `CARVIS_CLAUDE_CODE_BARE=0` 分支，远端脚本默认关闭 bare；因 SSH 再次不可用，尚未复测远端 real MVP

### 测试指标判断

- 本轮涉及层：`03-agentruntime`、`04-claudecode`、`06-workplaces`、`07-output`、`01-electron`
- 应执行测试：`npm run typecheck`、相关 smoke
- 实际执行测试：`typecheck`、`setup:smoke`、`messagebus:smoke`、`electron:smoke`、`agentruntime:smoke`、`workplaces:smoke`、`output:smoke`、`claudecode:smoke`、`e2e:smoke`
- 未执行项及原因：真实 Electron 窗口视觉验收尚未建立；真实长驻 Claude PID Agent 尚未实现；五角色真实 Claude Code MVP smoke 因远端 SSH 入口当前不可用未能在 NixOS 执行

### GitHub 状态

- 当前分支：`main`
- 本轮提交：无
- push 状态：未 push，原因是用户明确要求“可以写本地文件不上传 git”

### 回滚判断

- 是否需要回滚：否
- 当前改动未提交；如需丢弃本轮本地改动，需先确认用户允许，再按文件范围清理，禁止擅自 reset

### 下一步

- Phase 5：实现真实 Claude Code PID Agent 启动、输入、输出捕获、保活和 shutdown。
- 将 AgentRuntime 的模拟 role runner 替换为可选 Claude Code role runner。
- 建立真实 Electron 窗口或 renderer。

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

## 2026-07-02 / MVP NixOS 验收 / 本地交付

### 目标

按施工文档 Phase 1-8 的最小验收口径，把 Carvis MVP 在 NixOS 上跑通。

### 计划回放

- 读取施工主需求、施工计划、测试指标和架构文档。
- 补齐 setup、messagebus、electron、agentruntime、claudecode、workplaces、output、e2e 的最小 TypeScript 实现和 smoke。
- 在 NixOS 上执行完整本地 smoke 和真实 DeepSeek/Claude Code MVP smoke。
- 按用户要求只写本地文件，不提交、不 push。

### 实际修改

- `package.json` 新增 `npm test`，串联 `typecheck`、`setup:smoke`、`setup:spawn-smoke`、各子系统 smoke 和 `e2e:smoke`。
- `scripts/run-nixos-mvp-smoke.sh` 远端 dry 阶段改为 `npm test`，并支持 `CARVIS_REMOTE_HTTPS_PROXY` / `CARVIS_REMOTE_HTTP_PROXY`。
- 新增/完善最小 MVP 链路：
  - setup spawn 长跑组件 smoke
  - messagebus 事件转发
  - Electron shell 五角色面板和 output ready 状态
  - agentruntime 角色顺序 `manager -> writer/artist/researcher -> engineer`
  - claudecode DeepSeek/Claude Code print runner
  - workplaces 和 output manifest/final report
  - e2e smoke 和真实 `mvp:real-smoke`
- NixOS 远端已禁用自动关机、休眠、屏幕自动熄屏和自动锁屏。

### 验证结果

- 本地 `npm test`：通过。
- NixOS `./scripts/run-nixos-mvp-smoke.sh 192.168.137.59`：通过。
- NixOS `mvp:real-smoke`：通过，真实调用 DeepSeek Anthropic 兼容接口和 Claude Code CLI。
- NixOS 自动关机/休眠：`logind` 和 `systemd.sleep` 配置已验证。
- NixOS 屏幕休眠：`kscreenlockerrc`、`powerdevilrc`、X11 `xset` 已验证，DPMS disabled，screen saver timeout 0。

### 测试日志

- 第 1 次：本地 `npm test`，通过。
- 第 2 次：NixOS `npm test`，通过。
- 第 3 次：NixOS `CARVIS_REAL_MVP_SMOKE=1 ... npm run mvp:real-smoke`，通过。
- 曾遇到问题：NixOS 直连 `api.deepseek.com` DNS/出口不稳定，Claude Code 调用超时。
- 修复动作：临时在本机 `192.168.137.2:18080` 启动 HTTP CONNECT 代理，远端脚本通过 `CARVIS_REMOTE_HTTPS_PROXY` / `CARVIS_REMOTE_HTTP_PROXY` 透传。
- 复测结果：完整 NixOS MVP smoke 通过。

### 测试指标判断

- 本轮涉及层：setup、messagebus、electron、agentruntime、claudecode、workplaces、output、集成验收、NixOS 环境。
- 应执行测试：`npm run typecheck`、`npm test`、各子系统 smoke、`e2e:smoke`、NixOS 真实 `mvp:real-smoke`。
- 实际执行测试：本地 `npm test`；远端 NixOS `npm test`；远端 NixOS `mvp:real-smoke`。
- 未执行项及原因：未执行 GitHub push，原因是用户明确要求“可以写本地文件不上传 git”。

### GitHub 状态

- 当前分支：`main`
- 当前本地基线：`2942a3b`
- 本轮提交：无
- push 状态：未 push，按用户要求保留本地文件。
- 真实 API Key 未写入仓库文件。

### 回滚判断

- 本地代码回滚：还原本轮未提交改动即可。
- NixOS 自动休眠配置回滚：使用远端 `/etc/nixos/configuration.nix.bak.codex-no-autopower-1782925318` 或 `/etc/nixos/configuration.nix.bak.codex-no-screen-sleep`，再执行 `sudo nixos-rebuild switch`。
- 回滚后建议复测：本地 `npm test`；NixOS `./scripts/run-nixos-mvp-smoke.sh 192.168.137.59`。

### 下一步

- 若继续产品化，应把当前模拟 Electron shell 升级为真实 Electron UI。
- 若继续强化 Agent，应实现长驻 Claude Code PID、多轮输入和真实 PID 复用。

## 2026-07-02 / 跨进程 IPC 推进 / 本地交付

### 目标

补齐 setup spawn 后的真实跨进程通信缺口，让 messagebus 和 agentruntime 作为独立 Node 进程跑通一条命令链路。

### 实际修改

- 新增 `src/messagebus/ipc.ts`：
  - TCP JSONL messagebus server
  - remote messagebus client
  - 保持现有 `MessageBus` 接口
- `src/messagebus/main.ts` 改为启动 TCP server，默认端口 `45931`，支持 `CARVIS_MESSAGEBUS_PORT`。
- `src/agentruntime/main.ts` 改为连接远程 messagebus，并启动 runtime 订阅 `command.submitted`。
- `src/electron/main.ts` 改为连接远程 messagebus，并支持 `CARVIS_ELECTRON_SUBMIT_ON_START` 测试提交命令。
- `src/shared/componentMain.ts` 增加 shutdown hook，组件退出时可释放 server/client。
- 新增 `src/smoke/ipc.ts` 和 `npm run ipc:smoke`：
  - 启动真实 `messagebus` 子进程
  - 启动真实 `agentruntime` 子进程
  - Electron shell 作为第三个 TCP client 提交命令
  - 验证五角色状态、PID、`output.ready`
- `npm test` 已包含 `ipc:smoke`。

### 验证结果

- 本地 `npm run typecheck`：通过。
- 本地 `npm run ipc:smoke`：通过。
- 本地 `npm test`：通过。
- NixOS `npm test`：通过，包含 `ipc:smoke`。
- NixOS `mvp:real-smoke`：通过。

### 测试日志

- 第 1 次：`npm run typecheck`，失败，原因是 `Socket` type-only import 和 shutdown hook 类型错误。
- 修复：改为运行时导入 `Socket`，并用 `Promise.resolve(options.onShutdown?.())` 包装 hook。
- 第 2 次：`npm run ipc:smoke`，失败，原因是远程订阅初次连接时重复注册，导致 runtime 同一命令执行两遍；同时提交时序需要等待远程订阅建立。
- 修复：remote client 仅在已有 socket 时立即发送 subscribe，首次连接由 connect flush 订阅；smoke 等待订阅稳定；子进程按 runtime -> messagebus 顺序清理。
- 第 3 次：`npm run ipc:smoke`，通过。
- 第 4 次：`npm test`，通过。
- 第 5 次：NixOS 远端完整脚本，`npm test` 和 `mvp:real-smoke` 均通过。

### 测试指标判断

- 本轮涉及层：messagebus、setup、agentruntime、electron、集成 smoke。
- 应执行测试：`npm run typecheck`、`npm run ipc:smoke`、`npm test`、NixOS 远端 smoke。
- 实际执行测试：全部执行并通过。
- 未执行项及原因：未 push，按用户要求本地交付。

### 剩余风险

- TCP JSONL messagebus 是最小 IPC，尚未做认证、重连退避、背压和断连错误事件。
- Electron 仍是 shell 状态模型，不是真实 renderer UI。
- Claude Code 仍未升级成长驻 PID 复用。

## 2026-07-02 / Electron Renderer Snapshot / 本地交付

### 目标

补齐 Electron 层可视化缺口，在暂不引入 Electron runtime 依赖的前提下生成真实 HTML/CSS 工作台快照，支撑后续接入 `BrowserWindow`。

### 实际修改

- 新增 `src/electron/renderer.ts`：
  - `renderElectronHtml(state)`
  - `writeElectronRendererSnapshot(outputDir, state)`
- 新增 `src/electron/uiSmoke.ts` 和 `npm run electron:ui-smoke`。
- `npm test` 已包含 `electron:ui-smoke`。
- `electron/main.ts` 支持 `CARVIS_ELECTRON_RENDERER_DIR`，启动时可写出 `electron-shell.html`。
- `src/electron/README.md` 更新为 shell state + HTML renderer snapshot。

### 验证结果

- 本地 `npm run typecheck`：通过。
- 本地 `npm run electron:ui-smoke`：通过。
- 本地 `npm test`：通过。
- NixOS 远端 `npm test`：通过，包含 `electron:ui-smoke`。
- NixOS 远端 `mvp:real-smoke`：通过。

### 测试指标判断

- 本轮涉及层：Electron、集成 smoke、NixOS 验收。
- 应执行测试：`npm run typecheck`、`npm run electron:ui-smoke`、`npm test`、NixOS 远端 smoke。
- 实际执行测试：全部执行并通过。
- 未执行项及原因：未启动真实 Electron BrowserWindow，原因是当前项目尚未引入 Electron runtime 依赖；本轮先产出可被 BrowserWindow 加载的 HTML renderer。

### 剩余风险

- 尚未引入 `electron` 包和真实桌面窗口。
- 尚未做 Playwright/截图级 UI 检查。

## 2026-07-02 / 长驻 PID Agent 池 / 本地交付

### 目标

补齐 PID Agent 保活/复用/统一关闭的工程能力，先用通用行协议和 mock worker 验证生命周期，再为后续 Claude Code 长驻进程接入留接口。

### 实际修改

- 新增 `src/agentruntime/pidagent/index.ts`：
  - `PersistentPidAgentPool`
  - `PersistentPidAgent`
  - 行协议子进程任务投递、输出收集、timeout、retained 标记、统一 shutdown
- 新增 `src/agentruntime/pidagent/mockWorker.ts`。
- 新增 `src/agentruntime/pidagent/smoke.ts` 和 `npm run pidagent:smoke`。
- `npm test` 已包含 `pidagent:smoke`。

### 验证结果

- 本地 `npm run typecheck`：通过。
- 本地 `npm run pidagent:smoke`：通过。
- 本地 `npm test`：通过。
- NixOS 远端 `npm test`：通过，包含 `pidagent:smoke`。
- NixOS 远端 `mvp:real-smoke`：通过。

### 测试日志

- 第 1 次：`npm run typecheck`，通过。
- 第 2 次：`npm run pidagent:smoke`，通过。
- 第 3 次：`npm test`，通过。
- 第 4 次：NixOS 远端完整脚本，`npm test` 和 `mvp:real-smoke` 均通过。

### 测试指标判断

- 本轮涉及层：agentruntime、PID Agent lifecycle、集成 smoke、NixOS 验收。
- 应执行测试：`npm run typecheck`、`npm run pidagent:smoke`、`npm test`、NixOS 远端 smoke。
- 实际执行测试：全部执行并通过。
- 未执行项及原因：未把真实 Claude Code 交互模式改成长驻 PID，原因是 Claude Code 长驻 stdin/stdout 协议还需单独验证；本轮先完成可复用 PID Agent 池和生命周期验证。

### 剩余风险

- 当前长驻 PID smoke 使用 mock worker。
- 真实 Claude Code 仍通过 `--print` 短进程执行 `mvp:real-smoke`。

## 2026-07-02 / NixOS systemd unit 生成 / 本地交付

### 目标

补齐 NixOS 自启动交付物，让 setup 层能生成 user-level systemd units，明确 messagebus、agentruntime、electron 的启动顺序和依赖。

### 实际修改

- 新增 `src/setup/systemd.ts`：
  - 生成 `carvis-messagebus.service`
  - 生成 `carvis-agentruntime.service`
  - 生成 `carvis-electron.service`
  - 生成 `carvis.target`
- 新增 `src/setup/systemdSmoke.ts` 和 `npm run setup:systemd-smoke`。
- `npm test` 已包含 `setup:systemd-smoke`。
- systemd unit 固定：
  - `messagebus` 先启动
  - `agentruntime` Requires/After messagebus
  - `electron` Requires/After messagebus 和 agentruntime
  - 统一注入 `CARVIS_MESSAGEBUS_PORT`
  - `Restart=on-failure`

### 验证结果

- 本地 `npm run typecheck`：通过。
- 本地 `npm run setup:systemd-smoke`：通过。
- 本地 `npm test`：通过。
- NixOS 远端 `npm test`：通过，包含 `setup:systemd-smoke`。
- NixOS 远端 `mvp:real-smoke`：通过，真实使用 Claude Code CLI + DeepSeek API。

### 测试指标判断

- 本轮涉及层：setup、NixOS 自启动交付物、集成 smoke。
- 应执行测试：`npm run typecheck`、`npm run setup:systemd-smoke`、`npm test`、NixOS 远端 smoke。
- 实际执行测试：全部执行并通过。
- 未执行项及原因：未把 unit 安装到 NixOS 用户 systemd，原因是用户要求本地文件不上传 git；本轮先生成和验证 unit 内容。

### 剩余风险

- 尚未执行 `systemctl --user enable carvis.target` 的真实安装验收。
- Electron 仍未引入真实 Electron runtime。

## 2026-07-02 / systemd unit 安装器 / 本地交付

### 目标

将 setup 层从“生成 unit 内容”推进到“可安装到用户 systemd 目录”，并用 dry-run 临时目录验证落盘结果。

### 实际修改

- `src/setup/systemd.ts` 新增 `installSystemdUserUnits()`。
- 新增 `src/setup/systemdInstallSmoke.ts`。
- 新增 `npm run setup:systemd-install-smoke`。
- `npm test` 已包含 `setup:systemd-install-smoke`。

### 验证结果

- 本地 `npm run typecheck`：通过。
- 本地 `npm run setup:systemd-install-smoke`：通过。
- 本地 `npm test`：通过。
- NixOS 远端 `npm test`：通过，包含 systemd 安装 smoke。
- NixOS 远端 `mvp:real-smoke`：通过，真实使用 Claude Code CLI + DeepSeek API。

### 测试指标判断

- 本轮涉及层：setup、NixOS 自启动交付物、集成 smoke。
- 应执行测试：`npm run typecheck`、`npm run setup:systemd-install-smoke`、`npm test`、NixOS 远端 smoke。
- 实际执行测试：全部执行并通过。
- 未执行项及原因：未对真实 `~/.config/systemd/user` 执行 enable/start，避免在用户机器留下常驻服务；当前只做可重复 dry-run 安装验证。

### 剩余风险

- 真实 user systemd enable/start 尚未执行。
- NixOS 真实 DeepSeek 访问仍依赖临时本机代理。

## 2026-07-02 / systemd 安装 CLI / 本地交付

### 目标

把 systemd unit 安装能力从内部函数升级为可执行 CLI，支持 dry-run、install、uninstall 三种模式。

### 实际修改

- 新增 `src/setup/systemdInstall.ts`。
- `src/setup/systemd.ts` 新增 `uninstallSystemdUserUnits()`。
- `package.json` 新增 `setup:systemd-install`。
- `setup:systemd-install-smoke` 已覆盖：
  - CLI dry-run 写入临时目录
  - CLI uninstall 删除临时目录中的 Carvis units

### 验证结果

- 本地 `npm run typecheck`：通过。
- 本地 `npm run setup:systemd-install-smoke`：通过。
- 本地 `npm test`：通过。
- NixOS 远端 `npm test`：通过。
- NixOS 远端 `mvp:real-smoke`：通过，真实使用 Claude Code CLI + DeepSeek API。

### 测试指标判断

- 本轮涉及层：setup、NixOS 自启动交付物、集成 smoke。
- 应执行测试：`npm run typecheck`、`npm run setup:systemd-install-smoke`、`npm test`、NixOS 远端 smoke。
- 实际执行测试：全部执行并通过。
- 未执行项及原因：未在真实 `~/.config/systemd/user` 执行 install/enable，避免未经确认留下常驻服务。

### 剩余风险

- 真实 enable/start 仍待用户确认后执行。
- NixOS 直连 DeepSeek 出口仍不稳定，真实 smoke 仍通过临时代理完成。

## 2026-07-02 / NixOS WiFi 直连 DeepSeek 复验

### 目标

按用户要求切回 NixOS WiFi，验证真实 Claude Code + DeepSeek MVP smoke 不依赖本机临时代理。

### 验证结果

- NixOS `wlan0` 已连接 `kyle`。
- 默认路由优先走 WiFi：`default via 192.168.135.247 dev wlan0`。
- NixOS 直连 `https://api.deepseek.com/models` 返回未认证响应，说明出口可通。
- 未设置 `HTTP_PROXY` / `HTTPS_PROXY` 的情况下，NixOS `mvp:real-smoke` 通过。

### 结论

- NixOS 当前可通过 WiFi 直连 DeepSeek。
- 真实 MVP smoke 已确认使用 Claude Code CLI + DeepSeek API，并在 WiFi 路由下通过。

## 2026-07-02 / NixOS 永久长亮配置

### 目标

按用户要求关闭 NixOS 熄屏，设置永久长亮。

### 实际修改

- 远端备份 `/etc/nixos/configuration.nix`：
  - `/etc/nixos/configuration.nix.bak.codex-permanent-screen-on`
  - `/etc/nixos/configuration.nix.bak.codex-permanent-screen-on-fix`
- 在 NixOS 配置中增加 `services.xserver.serverFlagsSection`：
  - `BlankTime=0`
  - `StandbyTime=0`
  - `SuspendTime=0`
  - `OffTime=0`
- 增加 activation script：`system.activationScripts.carvisNoScreenSleep`
- 生成登录自启动脚本：`/home/howtion/.local/bin/carvis-no-screen-sleep`
- 生成 KDE autostart：`/home/howtion/.config/autostart/carvis-no-screen-sleep.desktop`
- 脚本每次登录执行：
  - `xset -dpms`
  - `xset s off`
  - `xset s noblank`
  - 关闭 KDE 自动锁屏
  - 关闭 PowerDevil 的 DimDisplay、DPMSControl、SuspendSession

### 验证结果

- `sudo nixos-rebuild switch`：通过。
- 当前 X11 会话：
  - Screen Saver `timeout: 0`
  - DPMS Standby/Suspend/Off 均为 `0`
  - `DPMS is Disabled`
- `kscreenlockerrc`：
  - `Autolock=false`
  - `LockOnResume=false`
  - `Timeout=0`
- `powerdevilrc`：
  - AC/Battery/LowBattery 的 `DimDisplay idleTime=0`
  - AC/Battery/LowBattery 的 `DPMSControl idleTime=0`
  - AC/Battery/LowBattery 的 `SuspendSession idleTime=0`

### 结论

- NixOS 已设置为永久长亮。
- 当前会话已立即生效。
- 重启或重新登录后会通过 X server flags 和 KDE autostart 再次应用。

## 2026-07-02 / systemd status CLI / GitHub 备份前收尾

### 目标

补齐 user systemd 安装后的静态状态检查能力，备份前确认本地测试通过且不泄露 API Key。

### 实际修改

- `src/setup/systemdInstall.ts` 新增 `CARVIS_SYSTEMD_INSTALL_MODE=status`。
- `status` 模式检查四个 Carvis unit 文件是否存在。
- `setup:systemd-install-smoke` 覆盖：
  - dry-run 后 status 成功
  - uninstall 后 status 失败并报告 missing

### 验证结果

- 本地 `npm test`：通过。
- API Key 文件扫描：未发现测试 key 写入仓库文件。

### GitHub 状态

- 本轮准备创建 GitHub 备份分支。
- 备份分支只用于保存当前本地 MVP 工作区，不直接推送 `main`。
- GitHub 备份分支：`backup/mvp-nixos-20260702-020835`
- GitHub 主体备份提交：`6e68339`
- GitHub 最新备份提交：以 `origin/backup/mvp-nixos-20260702-020835` 的 HEAD 为准
- push 状态：已推送到 `origin/backup/mvp-nixos-20260702-020835`
