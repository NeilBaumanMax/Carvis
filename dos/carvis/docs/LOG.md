# Carvis Construction Log

## 2026-07-09 / 一键启动脚本 + 移除自启动 / 施工记录

### 本轮计划回放

- 发现项目通过 3 个 macOS LaunchAgent plist 自启动（登录时自动拉起 + KeepAlive 自动重启）
- 用户要求禁用自启动，改为手动一键脚本
- 创建 scripts/start.sh 和 scripts/stop.sh
- GitHub 备份
- 修正文档漂移

### 实施记录

#### 变更摘要

- 移除 3 个 LaunchAgent plist 文件：
  - `~/Library/LaunchAgents/com.carvis.electron.plist`
  - `~/Library/LaunchAgents/com.carvis.messagebus.plist`
  - `~/Library/LaunchAgents/com.carvis.agentruntime.plist`
- 创建 `scripts/start.sh`：一键启动（build → messagebus → agentruntime → electron）
- 创建 `scripts/stop.sh`：PID 文件停止 + 进程名兜底清理
- `.gitignore` 新增 `scripts/.pids/` 和 `scripts/logs/`
- 文档漂移修正：CODEX_START_HERE, ARCHITECTURE, HANDOFF, DEV_PROGRESS, LOG, 00-setup

#### 发现的问题

- plist 文件中 WorkingDirectory 指向 `/Users/neil/Agent/Carvis`，但项目实际在 `/Users/neil/Documents/Project/Carvis`
- plist 文件包含明文 API Key（DEEPSEEK_API_KEY, DASHSCOPE_API_KEY），已随文件删除
- 文档中无任何 LaunchAgent 自启动的记录

#### 测试结果

- `npm run typecheck`：通过
- `npm run build`：通过

### 遗留项与下一步

- 验证 `scripts/start.sh` 端到端工作（需 Electron 窗口确认）
- GitHub push（需解决 push 权限问题）

### GitHub 状态

- 当前分支：`macos-deploy`
- 本轮提交：`0b536e3 feat: add start.sh/stop.sh one-click scripts + remove LaunchAgent auto-start`
- 备份分支：`backup/pre-oneclick-scripts-20260709-1817`（本地）
- push 状态：待 push（`neilbauman666` 凭证对 `NeilBaumanMax/Carvis` 无 push 权限）

### 回滚判断

- 是否需要回滚：否
- 如需恢复自启动：备份分支 `backup/macos-deploy-20260709-1356` 保留原 plist 文件

---

## 2026-07-09 / macOS 部署迁移 / 施工记录

### 本轮计划回放

- 基于 `backup/mvp-nixos-20260702-020835` 分支在 macOS 上部署 Carvis
- 移除 NixOS/systemd/NAS 特有组件
- macOS 适配（SDK 二进制路径、消息总线 TCP）
- 编译验证 + 全量 smoke 测试
- 文档漂移修正

### 实施记录

#### 变更摘要

- 创建 `macos-deploy` 分支（基线 `1d090af`）
- 删除文件：`src/setup/systemd.ts`, `systemdInstall.ts`, `systemdSmoke.ts`, `systemdInstallSmoke.ts`, `spawnSmoke.ts`
- 删除目录：`nas/`
- 删除脚本：`scripts/run-nixos-mvp-smoke.sh`, `scripts/probe-nixos-ssh.sh`
- 修改 `package.json`：移除 `setup:spawn-smoke`, `setup:systemd-smoke`, `setup:systemd-install-smoke`, `setup:systemd-install` 脚本
- 依赖安装：`@anthropic-ai/claude-agent-sdk@0.3.205`, react 19.2.7, vite 8.1.3 等 127 packages
- 文档修正：ARCHITECTURE.md, DEV_PROGRESS.md, LOG.md, HANDOFF.md, TEST_METRICS.md

#### 测试结果

| Suite | 结果 |
|---|---|
| typecheck (main + ui) | ok |
| build (main + ui) | ok |
| setup:smoke | ok |
| messagebus:smoke | ok |
| electron:smoke | ok |
| electron:ui-smoke | ok |
| electron:browser-smoke | ok |
| agentruntime:smoke | ok |
| pidagent:smoke | ok |
| runtime-pidagent:smoke | ok |
| workplaces:smoke | ok |
| output:smoke | ok |
| claudecode:smoke | ok (dry) |
| e2e:smoke | ok |
| ipc:smoke | ok (TCP messagebus + agentruntime 真实通信) |
| ipc:reconnect-smoke | ok |

`npm test`：15 SMOKES ALL PASSED，零回归。

### 遗留项与下一步

- 真实 Agent 验证（`mvp:real-smoke`）需配置 `DEEPSEEK_API_KEY`
- 三进程完整系统启动验证
- push `macos-deploy` 分支到 GitHub
- 确认 `@anthropic-ai/claude-agent-sdk` warm SDK 在 macOS 上正常启动

### GitHub 状态

- 当前分支：`macos-deploy`
- 远端仓库：`https://github.com/NeilBaumanMax/Carvis.git`
- push 状态：待 push（真实 Agent 验证通过后再 push）

### 回滚判断

- 是否需要回滚：否
- `macos-deploy` 为一独立分支，不影响 `main`
- 如需回滚到原 NixOS 版本：`git checkout backup/mvp-nixos-20260702-020835`

### 下一步

1. 用户提供 DeepSeek API Key → 创建 `keys.txt` → 运行 `CARVIS_REAL_MVP_SMOKE=1 npm run mvp:real-smoke`
2. 三进程启动验证
3. push 到 GitHub

---



> 历史记录：本节记录 NAS 初次接入结果。当前 WiFi 入口、系统 Go、防火墙和 NAS 启动自修复状态以文末 `NAS WiFi startup hardening and documentation drift fix` 为准。

### 本轮计划回放

- 新增 `carvis/nas/` 作为手机远程控制端。
- Electron 对外提供远程草稿和提交 API。
- 手机 Web 输入时，Electron 右侧输入框实时同步，并在办公室画面上浮字。
- Electron 右上角显示局域网 IP 和手机访问 URL。
- NAS Go server 读取真实 output/history 路径并渲染预览，不复制历史产物。

### 本次修改

- 新增 `src/electron/remoteApi.ts`，Electron 主进程启动 HTTP API，默认监听 `0.0.0.0:45932`。
- `ElectronShellState` 新增 `remoteDraft`、`remoteAccess`；`cloneState()` 已保留新增字段。
- `browserMain.ts` 在 app ready 后启动 remote API，并在窗口关闭时关闭 API server。
- `carvisui`：
  - 顶部右上角显示 `IP` 和 `phoneUrl`。
  - 监听 `remoteDraft`，同步输入框并显示 `remote-draft-float`。
  - 监听 `submittedCommands` 增量，让远程提交触发本地同款协同动画。
- 新增 `nas/`：
  - `apps/client` 手机网页。
  - `apps/server` Go 标准库 server。
  - `config`、`infra`、`packages`、`docs`。
  - 参考图复制为 `nas/docs/reference-ui.jpg`。
- `src/setup` 增加 `nas` 组件，`carvis.target` 已包含 `carvis-nas.service`。
- 桌面快捷脚本 `~/.local/bin/start-carvis.sh` 已改为重启四个服务：messagebus、agentruntime、electron、nas。

### 验证结果

- 本地 `npm run typecheck`：通过。
- 本地 `npm run build`：通过。
- NixOS `npm run build`：通过。
- NixOS Electron API：
  - `GET /api/health` 返回 `{"ok":true,"service":"carvis-electron-api"}`。
  - `POST /api/input` 后 `GET /api/state` 返回 `remoteDraft` 和 `remoteAccess`。
- NixOS services：messagebus、agentruntime、electron 均 active。
- NixOS `electron:visual-smoke`：通过，截图 1280x720。
- NixOS `nas/carvis-nas-server` 使用 Go 1.22.12 临时工具链编译通过。
- NixOS `carvis-nas.service` active，监听 `*:8765`。
- NixOS setup 安装后的 `carvis.target` Requires/After 包含 `carvis-nas.service`。
- NixOS 重启后四服务自启动通过：messagebus、agentruntime、electron、nas 均 active。
- 重启后端口验收：`45931`、`45932`、`8765` 均监听。
- 重启后 `POST http://192.168.137.59:8765/api/input` 可同步到 Electron `remoteDraft`。
- `GET http://192.168.137.59:8765/api/history` 返回历史列表。
- 临时预览 smoke：txt/html/pdf/docx/xlsx 均能返回移动端预览页，docx/xlsx 文本抽取通过。
- 本地 `npm test`：通过。
- NixOS 重启后 `electron:visual-smoke`：通过，截图 1280x720。

### 未完成/阻塞

- NixOS 仍没有全局 `go`；本轮用 `/tmp/carvis-go/go/bin/go` 编译 NAS server。
- `spectacle` 截图本轮崩溃，未得到持久窗口远程浮字截图；API/state/visual smoke 已覆盖核心链路。

### 下一步

- 如需使用 nginx 域名，把最终 `carvis.lan` 写入 `CARVIS_NAS_PUBLIC_URL` 或 `CARVIS_NGINX_URL` 后重启 Electron/NAS。
- 后续把 Go 工具链纳入 NixOS profile 或项目构建说明。

## 2026-07-03 / Install carvisui as Electron UI

### 本轮计划回放

- 把用户提供的 `/home/howtion/桌面/郑州黑客松/carvisui/carvisUI/carvisUI/` React/Vite 前端替换进 Carvis Electron。
- 角色映射：主管=`manager`，设计=`artist`，文员=`writer`，调研=`researcher`，技术=`engineer`。
- 保留 UI 已有像素办公室、气泡流式文字、信件轨迹和动作状态。
- 右侧只保留输入、当前 output、历史 output 文件夹打开。
- 在 NixOS 上运行，跑四个测试任务并截图验证。

### 本次修改

- 新增 `src/electron/carvisui/`，纳入用户 UI 源码和当前实际引用的素材目录。
- 新增 UI 独立 `tsconfig.json` 和 Vite 构建配置，`npm run build` 现在同时构建主进程和 Electron UI。
- BrowserWindow 优先加载 `dist/electron/carvisui/index.html`，旧 renderer snapshot 保留为 fallback。
- preload 仍是唯一 IPC 边界；UI 通过 `window.carvis.getState/submitCommand/openOutput/onState` 接入 Carvis。
- UI hook 从模拟 workflow 改为监听真实 `ElectronShellState`，把 Carvis role/status/output 映射为 UI 角色、气泡和信件动作。
- 右侧 output 展示最新 run 的 `game-preview.html`、`final-report.md`、`manifest.json` 并可打开位置；历史区列出所有回填 output run 文件夹。
- Electron 启动默认回填所有历史 output，但不再自动打开历史或新产物预览；需要显式 `CARVIS_AUTO_OPEN_GAME_PREVIEW=1` 才自动打开，避免盖住主 UI。
- 修复 Vite `file://` 下 React 运行时图片路径，新增 `assetPath()`。
- 更新 `electron:ui-smoke`、`electron:browser-smoke`、`electron:visual-smoke` 以验证新 UI。

### 验证结果

- 本地 `npm run typecheck`：通过。
- 本地 `npm run build`：通过。
- 本地 `npm run electron:ui-smoke`：通过。
- 本地 `npm run electron:browser-smoke`：通过。
- 本地 `npm test`：通过。
- NixOS `npm run build`：通过。
- NixOS `electron:visual-smoke`：通过，截图 `/tmp/carvis-electron-visual-smoke/carvis-electron-visual-smoke.png`，本地副本 `/tmp/carvis-electron-visual-smoke.png`。
- NixOS services：`carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service` 均 active。
- NixOS 主 UI 截图：`/tmp/carvis-ui-final-main.png`，显示 `Carvis`、五角色静止、右侧输入/output/history。

### 四个 NixOS 测试任务

- 测试 1 galgame：`output/runs/20260702-232642-req-ui-test1-1783034802445-测试1：请五个角色协作生成一个原创中文-galgame，主题灵感`
  - 标题：`金羽 — 视觉小说`
  - `game-preview.html` 约 42KB，脚本语法检查通过，引用 assets。
- 测试 2 冒险闯关：`output/runs/20260702-233749-req-ui-test2-1783035469308-测试2：请五个角色协作生成一个原创中文冒险闯关游戏，主题气质受到`
  - 标题：`夜奔 · 逃出规城`
  - `game-preview.html` 约 57KB，脚本语法检查通过，包含 canvas，引用 assets。
- 测试 3 类 Bazaar 商店/自动战斗：`output/runs/20260702-234356-req-ui-test3-1783035836764-测试3：请五个角色协作生成一个原创中文浏览器游戏，玩法结构参考-`
  - 标题：`星尘商路 — 浮岛商战录`
  - `game-preview.html` 约 45KB，脚本语法检查通过，引用 assets，命中购买/刷新/战斗/金币。
- 测试 4 open-yachiyo 文档 HTML：`output/runs/20260702-235047-req-ui-test4-1783036247181-测试4：请五个角色协作整理-GitHub-仓库-sdyzjx-o`
  - 标题：`open-yachiyo 仓库分析文档`
  - `game-preview.html` 约 26KB，脚本语法检查通过，引用 assets，命中 open-yachiyo/脚手架/目录结构/文件用途/安装/启动。

### 测试指标判断

- 本轮涉及层：`01-electron`、`02-messagebus`、`03-agentruntime`、`07-output`。
- 应执行测试：typecheck/build、Electron UI/browser smoke、NixOS 真实服务运行、四个真实任务、截图。
- 实际执行测试：全部完成。
- 残余风险：主 UI 是 1000x640，在 1280x720 任务栏环境下历史区底部只露出首条，需要后续做更紧凑响应式；当前不影响输入、output 展示和打开路径。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 开发前状态：工作区干净，远端分支存在。
- 本轮功能提交：`32623d2 feat: install carvisui electron renderer`；最终最新提交以 `git log -1` 为准。
- push 状态：已 push 到 `origin/backup/mvp-nixos-20260702-020835`。

### 回滚判断

- 是否需要回滚：否。
- 回滚方式：`git revert <本轮提交>`，或设置 `CARVIS_ELECTRON_UI_HTML` 指向旧/备用 HTML 后重启 Electron。

### 下一步

- 后续可继续压缩 1000x640 下右侧历史区布局，并增加真实服务窗口 capture 脚本。

## 2026-07-03 / NixOS readback and documentation drift fix

### 本轮计划回放

- SSH 连接 NixOS 远端，读取真实 systemd、provider worker、workplace/output 和 usage 状态。
- 修正文档中与当前代码和远端运行事实不一致的描述。
- 不修改运行时代码，不写入任何 API Key。

### 本次修改

- 更新入口文档，明确当前已是可运行 MVP 后的漂移修正阶段。
- 更新架构、层契约、施工计划和测试指标，修正当前 production flow。
- 更新分层进度，记录远端 active services、五个 retained `providerWorker`、`workplaces/runs/<run>`、`output/runs/<run>`、`usage.json`。
- 保留历史 manager review gate 和 fullscreen/kiosk 记录，但新增当前状态说明，避免误读为当前生产流。

### 修改文件

- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
- `dos/carvis/CODEX_START_HERE.md`
- `dos/carvis/docs/ARCHITECTURE.md`
- `dos/carvis/docs/LAYER_CONTRACT.md`
- `dos/carvis/docs/CONSTRUCTION_PLAN.md`
- `dos/carvis/docs/TEST_METRICS.md`
- `dos/carvis/docs/DEV_PROGRESS.md`
- `dos/carvis/docs/HANDOFF.md`
- `dos/carvis/docs/progress/layers/*.md`
- `README.md`
- `src/*/README.md`

### 验证结果

- SSH `howtion@192.168.137.59`：通过，主机名 `nixos`。
- 远端 `carvis-messagebus.service`：active。
- 远端 `carvis-agentruntime.service`：active，5 个 `providerWorker` PID active。
- 远端 `carvis-electron.service`：active。
- 远端最新 `output/runs/.../manifest.json`：包含 `finalReportPath`、`gamePreviewPath` 和五个 role result `sourcePath`。
- 远端最新 `workplaces/runs/.../engineer/usage.json`：provider 为 `deepseek-claudecode`。
- 远端最新 `workplaces/runs/.../artist/usage.json`：provider 为 `qwen-openai`，usage source 为 `provider`。
- `npm run typecheck`：通过。
- `npm run build`：通过。
- `npm test`：通过。
- `npm run artist-image-mcp:smoke`：通过。

### 测试日志

- 第 1 次：SSH readback，通过，确认远端服务、PID、manifest、usage。
- 第 2 次：`npm run typecheck`，通过。
- 第 3 次：`npm run build`，通过。
- 第 4 次：`npm run artist-image-mcp:smoke`，通过，覆盖本轮一并提交的 artist image MCP 规则改动。
- 第 5 次：`npm test`，通过，覆盖 setup/messagebus/electron/agentruntime/pidagent/workplaces/output/claudecode/e2e/ipc/reconnect smokes。

### 测试指标判断

- 本轮涉及层：文档、setup、electron、messagebus、agentruntime、claudecode、mcp、workplaces、output。
- 应执行测试：`npm run typecheck`、`npm run build`、SSH 远端 readback。
- 实际执行测试：SSH 远端 readback、`npm run typecheck`、`npm run build`、`npm run artist-image-mcp:smoke`、`npm test`。
- 未执行项及原因：真实 provider 新任务未执行，本轮没有运行时代码改动，且远端已有 active 服务和最新 run artifact 作为事实核验。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 基线提交：`8210390051741ece05a1a69edb686919069ff567`
- 备份分支：`origin/backup/mvp-nixos-20260702-020835`
- 开发前远端状态：origin 指向同一基线提交。
- 本轮提交：`docs: reconcile nixos runtime handoff`，最终提交号以 `git log -1` 为准。
- push 状态：已 push 到 `origin/backup/mvp-nixos-20260702-020835`。

### 回滚判断

- 是否需要回滚：否，当前为文档漂移修正。
- 回滚命令：`git revert <本轮提交>`。
- 回滚后复测：`npm run typecheck && npm run build`。

### 下一步

- 执行本地 typecheck/build。
- 更新 HANDOFF 最终提交和 push 状态。
- 已提交并 push 到当前备份分支。

## 2026-07-02 / Real provider role routing with DeepSeek and Qwen

### 目标

- 接入真实 provider，替换常驻 runtime 的纯本地模板生产。
- manager/engineer 使用 DeepSeek + Claude Code CLI。
- writer/artist/researcher 使用 Qwen3.5-Omni-Plus OpenAI 兼容接口。
- 每个角色注入对应 skills、plan 和上游 workplace 结果。
- NixOS 上通过 WiFi 测试。

### 实际修改

- 新增 `src/agentruntime/provider/roles.ts`，固定角色 provider 路由：
  - manager：DeepSeek Claude Code
  - engineer：DeepSeek Claude Code
  - writer/artist/researcher：Qwen OpenAI-compatible
- 新增 `src/agentruntime/provider/qwenOpenAi.ts`，按本地 `QWEN3.5-OMNI-PLUS_CODEX_SETUP.md` 使用 `/chat/completions`。
- 新增 `src/agentruntime/provider/providerWorker.ts`，作为长驻 PID worker；Runtime 统一 shutdown 前不关闭。
- `AgentRuntime` 新增 `pidTaskInputBuilder` 和 `pidOutput`，使 provider worker 输出可写入 workplace。
- `agentruntime/main.ts` 新增 `CARVIS_AGENTRUNTIME_REAL_PROVIDERS=1` 真实 provider 模式。
- prompt 注入内容包括用户原始任务、本角色 `skill.md`、`plan.md`、manager 规则/复审、员工 result。
- setup/systemd 增加 `EnvironmentFile=` 支持，用于 NixOS 本地 secret 文件。
- 新增 `provider:smoke`。

### 验证结果

- 本地 `npm run provider:smoke`：通过。
- 本地 `npm run setup:systemd-smoke`：通过。
- 本地 `npm run agentruntime:smoke`：通过。
- 本地 `npm run runtime-pidagent:smoke`：通过。
- 本地 `npm test`：通过。
- NixOS 默认路由优先 `wlan0`，DeepSeek/DashScope 域名均可访问。
- NixOS `npm run build`：通过。
- NixOS `CARVIS_CLAUDECODE_REAL_SMOKE=1 npm run claudecode:smoke`：通过，DeepSeek Claude Code 可用。
- NixOS 五角色全 DeepSeek `CARVIS_REAL_MVP_SMOKE=1 CARVIS_REAL_MVP_USE_SDK=0 npm run mvp:real-smoke`：通过。
- NixOS 五角色全 DeepSeek SDK warm `CARVIS_REAL_MVP_SMOKE=1 CARVIS_REAL_MVP_USE_SDK=1 npm run mvp:real-smoke`：通过。
- NixOS `CARVIS_QWEN_REAL_SMOKE=1 npm run provider:smoke`：未通过，Qwen 返回 `invalid_api_key`。
- 已尝试多个 Qwen base URL：DashScope 标准域、coding 域、token-plan/trial workspace 域、dashscope-intl 域，均未通过当前 Qwen key 鉴权。
- ModelScope OpenAI 域 `/chat/completions` 也鉴权失败。

### 结论

- 代码侧已完成 DeepSeek/Qwen provider 路由、skills/context 注入、长驻 provider worker PID 和本地 secret 注入能力。
- DeepSeek 真实调用已在 NixOS 通过。
- Qwen 真实调用未通过，原因是当前提供的 Qwen key 或 base URL 无效；需要有效 DashScope/Workspace API Key 或正确 workspace base URL 后才能完成 full real provider 验收。
- 在 Qwen key 修复前，不应把 systemd 常驻服务切到完整 `CARVIS_AGENTRUNTIME_REAL_PROVIDERS=1` 生产模式，否则 writer/artist/researcher 会失败。
- Qwen 问题已单独记录到根目录 `QWEN_API_ISSUE.md`。

## 2026-07-02 / Manager review gate before engineering

### 目标

- 按用户新目标，把主管职责从“一开始定规则分任务”升级为“员工完成后审核”。
- writer/artist/researcher 做出的东西必须先由主管检查有没有不达标、有没有偷懒。
- 全部通过后再传给 engineer 做最终制作。

### 实际修改

- `RunPhase` 新增 `manager_reviewing`。
- `AgentRuntime.executeRun()` 编排改为：
  - `manager_planning`
  - `parallel_roles_working`
  - `manager_reviewing`
  - `engineer_building`
  - `output_ready`
- manager agent 会运行两次：第一次规划，第二次复审。
- manager 二次运行时读取 writer/artist/researcher 的 workplace 结果，生成复审结论。
- 新增 `writeManagerReview()`：
  - 写入 `workplaces/live/manager/review.md`
  - 追加 `Manager Review Gate` 到 `workplaces/live/manager/result.md`
- manager review 通过才进入 engineer；如果 role runner 返回 `gatePassed: false`，runtime 会跳过 `engineer_building`。
- engineer 的 skill 协作规则更新为：只能在 `manager review gate` 通过后开始集成制作。
- 公开流式输出增加主管复审提示：未达标或偷懒不得交给 engineer 制作。

### 验证结果

- 本地 `npm run build`：通过。
- 本地 `npm run agentruntime:smoke`：通过，断言 manager 启动两次且第二次早于 engineer。
- 本地 `npm run workplaces:smoke`：通过，断言 `manager/review.md` 和 `Manager Review Gate` 追加。
- 本地 `npm run e2e:smoke`：通过。
- 本地 `npm run ipc:smoke`：通过。
- 本地 `npm run runtime-pidagent:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm run build`：通过。
- 远端 NixOS `carvis-agentruntime.service` / `carvis-electron.service`：active。
- 远端提交主管复审测试任务：通过。
- 远端 `workplaces/live/manager/review.md` 包含 `Gate 结论：全部通过，交给 engineer 进入制作集成`。
- 远端 `output/final-report.md` 包含 `Manager Review Gate` 和 `Engineer MVP Build List`。
- 远端截图 `/tmp/carvis-manager-review-gate.png` 显示 Manager 面板写入 review gate。

### 结论

- 主管现在具备前置规划和后置复审两段职责。
- engineer 已被放到主管复审之后，符合“都做成功通过了以后再传给技术制作”的目标。
- 本轮还补了失败 gate 的 smoke：主管复审不通过时 engineer 不会启动。

## 2026-07-02 / Agent role skills pack

### 目标

- 按用户要求给每个角色先装 3 个 skills。
- 提升五个 agent 的协作质量，避免只各自写文本设定。
- 在 NixOS 上跑通并保留 GitHub 备份。

### 实际修改

- 新增 `src/agentruntime/skills/index.ts`：
  - manager：`Scope Producer`、`Dependency Mapper`、`Acceptance Director`
  - writer：`Playable Narrative Bible`、`Choice Writer`、`Route Stitcher`
  - artist：`Art Bible Synthesizer`、`Asset Generation Brief`、`Readable Screen Director`
  - researcher：`Mechanic Translator`、`Balance Table Maker`、`Playtest Heuristic`
  - engineer：`Vertical Slice Builder`、`Integration Contract`、`Smoke Harness`
- `initializeWorkplaces()` 现在为每个角色写入 `skill.md`，并把 `plan.md` 改为技能驱动计划。
- `WorkplacePaths` 增加 `skillPath`，`WORKPLACE_FILES` 增加 `skill.md`。
- `agentruntime/main.ts` 的公开流式输出新增 skill 加载、协作规则、消费输入、必须产出和质量门槛。
- `workplaces:smoke` 新增断言：每个角色必须存在 `skill.md` 且恰好 3 个 skill。
- 没有直接安装网上第三方 skill 仓库；本轮采用项目内本地 skill，避免远程执行不可信脚本。

### 验证结果

- 本地 `npm run build`：通过。
- 本地 `npm run workplaces:smoke`：通过。
- 本地 `npm run electron:ui-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm run build`：通过。
- 远端 NixOS `carvis-agentruntime.service` / `carvis-electron.service`：active。
- 远端 NixOS `npm run workplaces:smoke`：通过。
- 远端通过 messagebus 提交原创爬塔卡牌任务：通过。
- 远端 `output/final-report.md` 包含 `星炉远征`，`output/game-preview.html` 已生成。
- 远端五个角色 `workplaces/live/*/skill.md` 均存在，并包含对应角色 skill。
- 远端截图 `/tmp/carvis-agent-skills.png`：1000x640 Electron 窗口可见五个 agent 面板和 Output 产物预览。

### 结论

- 每个角色已安装 3 个本地 skill。
- NixOS 上已完成构建、服务重启、workspace smoke 和真实任务验证。
- 当前仍是公开进度流与结果预览，不显示隐藏思考链。

## 2026-07-02 / 1000x640 centered Electron + Chinese agent output + game preview

### 目标

- 1280x720 屏幕上 agent 框内必须有明显可见变化，Electron 默认窗口改成 1000x640 居中，不再全屏。
- 五个 agent 框必须等比例压缩后同屏全部露出。
- 每个 agent 框内显示 Claude Code CLI 的公开进度/输出摘要，不显示隐藏思考链。
- agent 人设和输出约束要中文化。
- Output 区显示整个 output 产物文件夹预览，而不是只有路径按钮。
- 最终游戏预览生成 HTML，并通过 Chrome/Chromium 打开。
- 安装中文输入法。
- 从真实 Electron 输入框提交 RPG 任务，并确认屏幕有动静。

### 实际修改

- `src/electron/browserWindow.ts` 默认窗口宽高改为 `1000x640`，`center=true`，默认 `fullscreen=false`、`kiosk=false`。
- `src/electron/renderer.ts` 压缩布局，把 `.latest` 改成深色终端风格，显示 `LIVE CLI OUTPUT`，并在重绘后自动滚到底部；1000px 宽度不触发两列布局，五个 agent 保持一行。
- `src/electron/shell.ts` 对 agent 输出追加最近 80 行，并在 `output.ready` 后读取 `manifest.json`/`final-report.md` 生成预览。
- `src/electron/types.ts` 为 output 状态增加 `outputFolderPath`、`manifestEntries`、`previewText`。
- `src/agentruntime/main.ts` 常驻运行时发布中文化 `>>> LIVE CLI STREAM [...]` 公开进度；每个 agent 具有中文人设，并把实际 RPG 设计结果预览流式写回面板。
- `src/output/index.ts` 新增 `game-preview.html` 生成，Macbeth/Don Quixote 预览内容按报告识别。
- `src/electron/browserMain.ts` 支持 `CARVIS_GAME_PREVIEW_BROWSER_CMD` 指定 Chrome/Chromium 打开游戏预览。
- NixOS `/etc/nixos/configuration.nix` 增加 fcitx5 输入法和环境变量。
- NixOS 当前用户 `~/.config/fcitx5/profile` 设置默认 `pinyin`。

### 验证结果

- 本地 `npm run build`：通过。
- 本地 `npm run electron:ui-smoke`：通过。
- 本地 `npm run electron:browser-smoke`：通过。
- 本地 `npm run ipc:smoke`：通过。
- 远端 NixOS `nixos-rebuild switch`：通过。
- 远端 NixOS `fcitx5 -d`：运行中。
- 远端 NixOS 从真实 Electron 输入框提交《麦克白》RPG 任务：通过。
- 远端 NixOS `output/final-report.md` 已更新，包含中文 Macbeth RPG 方案。
- 远端 NixOS `output/game-preview.html` 已生成，包含 `麦克白 RPG Preview`。
- Chromium wrapper 已配置为 `~/bin/carvis-open-chromium`，首次 `nixpkgs#chromium` 下载较慢且受网络超时影响。
- 远端 NixOS `xprop`：Carvis 窗口 `program specified location: 140, 40`，符合 1280x720 上 `1000x640` 居中。
- 远端截图 `/tmp/carvis-1000x640-window.png`：五个 agent 框同屏全部可见。
- 本地完整 `npm test`：通过。
- 远端 NixOS 最新同步后 `npm run build`：通过，Electron/agentruntime user service 均 active。
- `src/agentruntime/main.ts` 新增《被掩埋的巨人》主题安全原创模板：只使用记忆、遗忘、老年、战后创伤、和解等主题，不复制受保护表达。
- `src/output/index.ts` 新增《雾下余烬》游戏预览内容。
- 远端通过 messagebus 提交原目标测试任务，生成 `雾下余烬` 中文报告和 `game-preview.html`。
- 远端截图 `/tmp/carvis-buried-giant-cn-1000x640.png`：五个 agent 框中文输出可见，Output 区显示产物文件夹预览。
- `src/agentruntime/main.ts` 新增《绿毛水怪》主题气质安全原创 galgame 模板，五个 agent 输出制作人、叙事、美术、系统、工程方案。
- `src/output/index.ts` 新增 `绿潮来信 Galgame Preview`。
- 远端通过 messagebus 提交“绿毛水怪 galgame”任务，生成 `绿潮来信` 中文报告和 `game-preview.html`。
- 远端截图 `/tmp/carvis-green-water-galgame.png`：五个 agent 框中文输出可见，Output 区显示产物文件夹预览。
- `src/agentruntime/main.ts` 新增原创爬塔卡牌 roguelike 模板，五个 agent 输出制作人、叙事、美术素材生成、系统、工程方案。
- `src/output/index.ts` 新增 `星炉远征 Card Roguelike Preview`。
- 远端通过 messagebus 提交“原创爬塔卡牌 roguelike，素材自己生成”任务，生成 `星炉远征` 中文报告和 `game-preview.html`。
- 远端截图 `/tmp/carvis-deck-tower.png`：五个 agent 框中文输出可见，Output 区显示产物文件夹预览。

### 结论

- 1280x720 屏幕上已有明显可见流式输出和 output 文件夹预览。
- 中文输入法已安装并在当前会话运行。
- “隐藏思考链”不可显示，当前实现显示的是可公开的 Claude Code CLI 进度和输出摘要。

## 2026-07-02 / Electron live renderer IPC

### 目标

- 补齐主施工文档中的真实窗口输入提交能力。
- 让 BrowserWindow renderer 不再只是静态 snapshot，而是能接收状态并提交命令。

### 实际修改

- `ElectronShell` 增加 `onStateChanged()`。
- `browserMain.ts` 注册 `carvis:get-state`、`carvis:submit-command`，并把 shell state 推送给 renderer。
- `browserWindow.ts` 支持 preload path。
- `renderer.ts` 写入 `electron-preload.cjs`，HTML 内置 live render 脚本。
- Output 入口通过 IPC 调用主进程 open path。
- `electron:browser-smoke` 增加 preload/live API 断言。
- `electron:visual-smoke` 增加真实窗口 submit、DOM live update 和 output open 断言。

### 验证结果

- 本地 `npm run build`：通过。
- 本地 `npm run electron:browser-smoke`：通过。
- 本地 `npm run electron:ui-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `electron:visual-smoke`：通过，截图 `1280x720`，并覆盖 live submit/live update/output open。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke` with `CARVIS_REAL_MVP_USE_SDK=1`：通过。
- 远端 NixOS `carvis-electron.service` 重启后 active，窗口 `1280x720+0+0`。

### 结论

- 真实 Electron BrowserWindow 已支持窗口内输入提交和状态实时刷新。
- Output 入口已通过主进程 IPC 打开路径。
- Electron 仍通过 messagebus 间接提交命令，未破坏层边界。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 本轮功能提交：`759b000 backup: make electron renderer live`
- push 状态：已 push 到 `origin/backup/mvp-nixos-20260702-020835`

## 2026-07-02 / Claude Agent SDK warm runner + NixOS 复验

### 目标

- 继续验证 Claude Code 是否能以长期进程方式服务 NixOS MVP。
- 让 Electron 在 NixOS 上保持真实全屏显示。

### 实际修改

- 新增 `@anthropic-ai/claude-agent-sdk` 依赖。
- 新增 `src/agentruntime/claudecode/warmSdk.ts`。
- 新增 `src/agentruntime/claudecode/warmSdkSmoke.ts`。
- 新增 `src/agentruntime/claudecode/warmSdkRoleRunner.ts`。
- `mvp:real-smoke` 增加 `CARVIS_REAL_MVP_USE_SDK=1` 路径。
- `package.json` 增加 `claudecode:sdk-smoke`。
- 更新 claudecode README、DEV_PROGRESS、HANDOFF 和分层进度。

### 验证结果

- 本地 `npm run build`：通过。
- 本地 `npm run claudecode:sdk-smoke`：通过 dry。
- 本地 `npm test`：通过。
- 远端 NixOS `npm run claudecode:sdk-smoke`：通过 dry。
- 远端 NixOS `CARVIS_CLAUDECODE_SDK_REAL_SMOKE=1 ... npm run claudecode:sdk-smoke`：通过 real。
- 远端 NixOS `CARVIS_REAL_MVP_SMOKE=1 CARVIS_REAL_MVP_USE_SDK=1 ... npm run mvp:real-smoke`：通过 real。
- 远端 NixOS Electron 复核：`Carvis` 窗口 `1280x720+0+0`。
- 远端 NixOS 屏幕休眠复核：screen saver timeout `0`，DPMS disabled。

### 结论

- NixOS 上真实 Electron 已全屏。
- Claude Code 可通过 Agent SDK 预热子进程，任务到达时直接提交 prompt。
- SDK warm handle 不是无限多轮复用接口；每次 query 后需要重新 warm 下一轮。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 本轮功能提交：`f6e8365 backup: add claude sdk warm runner`
- push 状态：已 push 到 `origin/backup/mvp-nixos-20260702-020835`

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
- 新增 `src/electron/runBrowserMain.ts`，让 systemd 可以用 Node runner 启动 NixOS Electron runtime。
- BrowserWindow 默认 `fullscreen=true`、`kiosk=true`、隐藏菜单栏，并在 `ready-to-show` 后重复应用 fullscreen/kiosk。
- `setup/config.ts` 支持 `CARVIS_ELECTRON_BROWSER=1`、`CARVIS_ELECTRON_BIN`、`CARVIS_ELECTRON_START_DELAY_MS`，生成真实全屏 Electron systemd unit。
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
- 远端 NixOS 安装 systemd browser unit 后，`carvis-electron.service` active，`ExecStart=/run/current-system/sw/bin/node dist/electron/runBrowserMain.js`。
- 远端 NixOS 重启后，WiFi 走 `wlan0/kyle`，六个 user service 均 active，`Carvis` 窗口为 `1280x720+0+0`，`DPMS is Disabled`。
- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS 真实 `mvp:real-smoke`：通过。

### 测试指标判断

- Phase 3 Electron 验收新增覆盖：真实 `BrowserWindow` 构造参数、sandbox webPreferences、加载 renderer HTML。
- 真实 Electron 二进制启动和截图验收已用 NixOS `nixpkgs#electron` 覆盖。
- 用户要求的 NixOS 全屏显示已覆盖：重启后窗口尺寸等于 X11 root `1280x720`。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 本轮提交：待收尾提交。
- push 状态：待 push。

### 下一步

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

## 2026-07-03 / NAS WiFi startup hardening and documentation drift fix

### 本轮计划回放

- 修正 NAS 手机端文案，让页面明确显示 WiFi 入口和 Carvis 主屏同步口径。
- 加固 NixOS 开机后 WiFi 访问路径，避免 `carvis-nas-server` 丢失导致 `8765` 不监听。
- 将当前真实运行状态写回文档，修正文档漂移。

### 本次修改

- `nas/apps/client/index.html`：文案改为“WiFi 入口 / 任务输入 / 当前输出 / 历史任务”。
- `nas/apps/client/app.js`：状态文案改为“Carvis 主屏”，顶部 URL 显示 `WiFi <url>`，不再优先展示 `carvis.lan`。
- NixOS `/etc/nixos/configuration.nix`：永久开放 TCP `8765` 和 `45932`，并将 `go` 纳入系统环境。
- NixOS user service：`carvis-nas.service` 增加 `ExecStartPre=/home/howtion/.local/bin/carvis-nas-ensure-server`。
- NixOS user service：`carvis.target` 改为 `Wants=` 四个服务，四个服务均单独 enable。
- NixOS 生成 NAS 二进制备份：`/home/howtion/.local/bin/carvis-nas-server.backup`。
- 更新 `README.md`、`nas/README.md`、`dos/carvis/docs/DEV_PROGRESS.md`、`dos/carvis/docs/HANDOFF.md`。

### 验证结果

- `sudo nixos-rebuild boot`：通过，生成 generation `24`。
- NixOS 重启一次：通过。
- NixOS `wlan0=192.168.135.250/24`：通过。
- NixOS `go=/run/current-system/sw/bin/go`：通过。
- NixOS 防火墙包含 TCP `8765` 和 `45932`：通过。
- NixOS `systemctl --user is-enabled` 五个 Carvis units：通过。
- NixOS `systemctl --user is-active` 五个 Carvis units：通过。
- NixOS `ss -ltnp` 包含 `127.0.0.1:45931`、`0.0.0.0:45932`、`*:8765`：通过。
- NixOS `GET http://192.168.135.250:8765/api/config`：通过。
- NixOS `GET http://127.0.0.1:45932/api/health`：通过。

### 测试日志

- 第 1 次：`sudo nixos-rebuild switch`，卡在激活阶段，无 systemd job 运行；终止后未作为完成结果记录。
- 第 2 次：`sudo nixos-rebuild boot`，通过，generation `24`。
- 第 3 次：重启 NixOS 后检查 WiFi、firewall、Go、services、ports、NAS API、Electron API，全部通过。
- 第 4 次：用户将“重启 4 次”改为“重启一次就行”，停止后续重启测试。

### 测试指标判断

- 本轮涉及层：NAS phone web、Electron HTTP API、NixOS user services、NixOS firewall、documentation。
- 应执行测试：NixOS rebuild、重启验收、service/port/API 检查。
- 实际执行测试：上述检查已执行并通过。
- 未执行项及原因：未执行 4 次连续重启，原因是用户后续明确改为只重启一次。

### GitHub 状态

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 基线提交：`2fc06de725a433409077b4c13d56bfed04c9ba3b`
- 备份分支：`origin/backup/mvp-nixos-20260702-020835`
- 本轮提交：未提交。
- push 状态：未 push，原因是工作区已有早前 agentruntime / image MCP 未提交改动，本轮只做漂移修正和远端配置加固。

### 回滚判断

- 是否需要回滚：否。
- NixOS 配置回滚点：`/etc/nixos/configuration.nix.bak.carvis-wifi-hardening-20260703-181914`。
- 远端 user service 回滚：移除 `~/.config/systemd/user/carvis-nas.service.d/10-ensure-server.conf` 和 WiFi URL drop-ins 后 `systemctl --user daemon-reload && systemctl --user restart carvis.target`。
- 文档回滚：使用 Git 对本轮文档文件做普通反向补丁或后续提交后 `git revert`。

### 下一步

- 如需提交，先将 NAS 文案/文档与 agentruntime 未提交改动拆分处理。
- 如需把远端手工 service drop-in 工程化，更新 `src/setup/systemd.ts` 和相关 smoke。
