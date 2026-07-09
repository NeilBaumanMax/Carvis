# Carvis Development Progress

## 2026-07-09 / macOS 部署迁移 / 进行中

### 本轮目标

- 基于 `backup/mvp-nixos-20260702-020835` 创建 `macos-deploy` 分支
- 移除 NixOS/Linux 特有组件（systemd 服务、NAS 模块、steam-run 脚本）
- 在 macOS 上完成依赖安装和编译验证
- 通过全量 smoke 测试（15 个测试全部通过）
- 待完成：真实 Agent 端到端验证（需配置 DeepSeek API Key）
- 待完成：完整三进程系统启动验证

### 完成项

- [x] 创建 `macos-deploy` 分支（基线：`1d090af release: bump carvis to 1.1`）
- [x] 删除 `src/setup/systemd*`、`nas/`、`scripts/run-nixos-mvp-smoke.sh` 等 NixOS 组件
- [x] `package.json` 移除 systemd/spawn-smoke 相关 scripts，保留 `mvp:real-smoke`
- [x] macOS 依赖安装：`@anthropic-ai/claude-agent-sdk@0.3.205`, react, vite 等
- [x] `npm run typecheck`（main + ui）通过
- [x] `npm run build`（main + ui）通过
- [x] `npm test`（15 smokes）全部通过
- [x] 修正文档漂移：ARCHITECTURE.md, DEV_PROGRESS.md, LOG.md, HANDOFF.md, TEST_METRICS.md

### 待完成

- [ ] 配置 `keys.txt`（DEEPSEEK_API_KEY）
- [ ] `CARVIS_REAL_MVP_SMOKE=1 npm run mvp:real-smoke`
- [ ] 三进程启动验证（messagebus → agentruntime → electron）

### 分支信息

- 当前分支：`macos-deploy`
- 基线提交：`1d090af`（backup/mvp-nixos-20260702-020835）
- 远端仓库：`https://github.com/NeilBaumanMax/Carvis.git`
- 待 push

---



### 本轮目标

- 修正 NAS 手机端文案，使页面明确显示 WiFi 入口和 Carvis 主屏同步口径。
- 加固 NixOS 开机后 WiFi 访问路径，避免断电/重启后 `8765` 不监听或地址显示错误。
- 将当前真实运行状态写回文档，修正文档漂移。

### 涉及层

- `nas/apps/client`
- `nas/apps/server`
- `01-electron`
- NixOS user services / firewall
- 接力文档与 README

### 本次完成

- 手机端文案已统一：
  - 顶部显示“WiFi 入口”。
  - 输入区显示“任务输入”。
  - 输出区显示“当前输出”。
  - 历史区显示“历史任务”。
  - 同步状态使用“Carvis 主屏”，不再直接写 Electron。
- 远端运行目录 `/home/howtion/carvis-remote-smoke/nas/apps/client/` 已同步新文案。
- NixOS WiFi URL 固定为 `http://192.168.135.250:8765`。
- NixOS `networking.firewall.allowedTCPPorts` 已配置 `[ 8765 45932 ]`。
- NixOS `environment.systemPackages` 已增加 `go`。
- `carvis-nas.service` 新增启动前自修复脚本 `/home/howtion/.local/bin/carvis-nas-ensure-server`：
  - 二进制存在且新于 source 时直接启动。
  - 有系统 `go` 时自动 rebuild。
  - 如 rebuild 不可用，回退到 `/home/howtion/.local/bin/carvis-nas-server.backup`。
- `carvis.target` 改为 `Wants=` 四个服务，并单独 enable 四个 service，避免 NAS 短暂自修复重启导致 target dependency failed。
- `sudo nixos-rebuild boot` 已生成 generation `24`。

### 当前验证

- NixOS 重启一次后 generation `24` 为 current。
- `go` 路径：`/run/current-system/sw/bin/go`。
- `wlan0`：`192.168.135.250/24`。
- 防火墙规则包含 TCP `8765` 和 `45932`。
- `carvis.target`、`carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service`、`carvis-nas.service` 均 enabled/active。
- 监听端口：
  - `127.0.0.1:45931`
  - `0.0.0.0:45932`
  - `*:8765`
- `GET http://192.168.135.250:8765/api/config`：通过，返回 `publicUrl=http://192.168.135.250:8765`。
- `GET http://127.0.0.1:45932/api/health`：通过。

### 未完成

- 用户最初要求 4 次重启，随后改为只重启 1 次；因此本轮只记录 1 次重启验收。
- 本轮没有 push。工作区仍有早前 agentruntime / image MCP 未提交修改。

### 下次优先任务

1. 如需工程化持久化 `carvis.target Wants=` 和 NAS `ExecStartPre`，更新 `src/setup/systemd.ts`。
2. 如需安全加固，给 `45932`/`8765` 加 token 或 WiFi 网段限制。
3. 分开提交 NAS 文案/文档与 agentruntime 未提交改动，避免混合提交。

## 2026-07-03 / NAS remote control and Electron HTTP API / 开工计划

> 历史记录：本节记录的是 NAS 初次接入时的状态。当前 WiFi 入口、系统 Go、防火墙和开机自修复状态以上方 `NAS WiFi startup hardening and copy drift fix` 记录为准。

### 本轮目标

- 在 `carvis/` 下新增 `nas/`，与现有 Electron/messagebus/agentruntime 系统同级。
- 把 Electron 原输入任务框和“开始协同”封装为 HTTP API，供 NAS Go server 和手机网页调用。
- 手机 Web 输入文字时，Electron 输入框实时同步，并在办公室画面上浮现输入文字。
- 手机点击启动时，Electron 触发同一套协同动画和 `command.submitted`。
- Electron 右上角显示当前局域网 IP 和手机应打开的远程 Web URL。
- NAS Go server 按白名单读取真实 `output/history` 路径，不复制产物，并提供移动端预览入口。

### 涉及层

- `01-electron`
- `02-messagebus`
- `07-output`
- `nas/apps/client`
- `nas/apps/server`

### 本次完成

- 新增 `src/electron/remoteApi.ts`，提供：
  - `GET /api/health`
  - `GET /api/state`
  - `POST /api/input`
  - `POST /api/submit`
- `ElectronShellState` 新增 `remoteDraft` 和 `remoteAccess`，并修正 `cloneState()` 保留这些字段。
- Electron 启动时监听 `0.0.0.0:45932`，默认手机 URL 为 `http://<LAN IP>:8765`。
- React UI 监听 `remoteDraft`，把手机 Web 输入实时回填到右侧输入框，并在办公室画面上显示短暂浮字。
- React UI 监听 `submittedCommands` 增量，远程提交时也启动同一套协同动画。
- 顶部右上角新增 IP 和远程 Web URL 展示。
- `src/setup` 已纳入 `nas` 组件，`carvis.target` 现在 Requires/After `carvis-nas.service`。
- NixOS 桌面快捷脚本 `~/.local/bin/start-carvis.sh` 已改为按顺序重启 messagebus、agentruntime、electron、nas。
- 新增 `nas/` 结构：
  - `apps/client`：手机控制网页，参考 `nas/docs/reference-ui.jpg` 的像素木质面板风格。
  - `apps/server`：Go 标准库 server，转发 Electron API，读取 output/history，支持 txt/md/html/pdf/docx/xlsx/csv/json 等预览。
  - `config`：`app.yaml`、`remote.yaml`、`electron.yaml`、`paths.yaml`。
  - `infra`：nginx、docker、systemd 示例。
  - `packages`：共享类型和协议说明。
  - `docs`：架构说明和参考 UI 图。

### 当前验证

- 本地 `npm run typecheck`：通过。
- 本地 `npm run build`：通过。
- NixOS `npm run build`：通过。
- NixOS `carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service`：active。
- NixOS Electron API `GET http://127.0.0.1:45932/api/health`：通过。
- NixOS Electron API `POST /api/input` 后，`GET /api/state` 返回：
  - `remoteDraft.text = "手机端实时输入测试二"`
  - `remoteAccess.ip = "192.168.137.59"`
  - `remoteAccess.phoneUrl = "http://192.168.137.59:8765"`
- NixOS `electron:visual-smoke`：通过，截图 `/tmp/carvis-electron-visual-smoke/carvis-electron-visual-smoke.png`，1280x720。
- NixOS 使用临时 Go 1.22.12 工具链构建 `nas/carvis-nas-server`：通过。
- NixOS `carvis-nas.service` 已由 setup 安装并纳入 `carvis.target`。
- NixOS 重启后验收：`carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service`、`carvis-nas.service` 均 active。
- NixOS 重启后端口：`127.0.0.1:45931`、`0.0.0.0:45932`、`*:8765` 均监听。
- 手机 URL `http://192.168.137.59:8765/api/config`：通过。
- 重启后 `POST http://192.168.137.59:8765/api/input` 可更新 Electron `remoteDraft.text = "重启后手机端实时输入验证"`。
- NAS 历史列表 `GET /api/history`：通过，返回 35 条。
- NAS 预览 smoke：txt/html/pdf/docx/xlsx 均返回预览页，docx/xlsx 文本抽取命中 `Hello Word Preview` / `Hello Excel Preview`。
- 本地 `npm test`：通过。
- NixOS 重启后 `electron:visual-smoke`：通过，截图 `/tmp/carvis-electron-visual-smoke/carvis-electron-visual-smoke.png`，1280x720。

### 未完成

- NixOS 没有全局 `go` 命令；当前用 `/tmp/carvis-go/go/bin/go` 临时工具链构建 NAS server。若 `/tmp` 被清理，下次修改 Go server 后需要重新放置 Go 工具链或安装系统 Go。
- `spectacle` 桌面截图曾崩溃，未拿到持久 Electron 窗口的远程浮字截图；已用 Electron API state、NAS API 和 visual smoke 验证主要链路。

### 下次优先任务

1. 若 nginx 已配置 `carvis.lan`，设置 `CARVIS_NAS_PUBLIC_URL` 或 `CARVIS_NGINX_URL` 后重启 Electron/NAS，让右上角显示最终域名。
2. 后续把 Go 工具链纳入 NixOS profile 或项目构建说明，避免依赖 `/tmp/carvis-go`。
3. 需要真实手机实测时，直接打开 `http://192.168.137.59:8765`。

## 2026-07-03 / Install carvisui as Electron UI / 开工计划

### 本轮目标

- 把用户提供的 `/home/howtion/桌面/郑州黑客松/carvisui/carvisUI/carvisUI/` 前端页面安装到 Carvis Electron。
- 在 NixOS 上运行新 UI，替换原 Electron 页面。
- 角色映射固定为：主管 -> `manager`，设计 -> `artist`，文员 -> `writer`，调研 -> `researcher`，技术 -> `engineer`。
- 保留 UI 已有动作与信件轨迹：未开始时静止，开始思考时头顶气泡流式显示公开进度，主管分发信件，三角色返回主管，主管交给技术，技术交给 output。
- 右侧只保留 UI 中已有入口：输入框、当前 output、历史 output 文件夹打开；原 Electron 其他功能先隐藏。
- 左上角标题从“仿真世界”改为 `Carvis`。
- 在 NixOS 上跑四个测试任务直到不出现 UI/运行 bug，并截图验证。

### 涉及层

- `01-electron`
- `02-messagebus`
- `03-agentruntime`
- `07-output`
- NixOS user service 部署与截图验收

### 计划修改

- 把 `carvisui` 的 React/Vite UI 作为 Electron renderer 资源接入项目。
- 扩展 Electron preload：提交任务、接收 state、打开 output 路径，必要时补充打开文件夹/历史 output 能力。
- 修改 UI workflow hook：从模拟任务改为驱动 Carvis 实际 `ElectronShellState`，并按 Carvis phase/agent output 推动动作状态。
- 修改右侧面板：当前 output 展示本轮生成文件并可打开位置；历史区列出已有 `output/runs/*` 文件夹并可打开。
- 补充 smoke/visual 验证，至少覆盖新 UI title、角色映射、提交命令、output/history 打开入口。

### 测试计划

- 本地 `npm run typecheck`
- 本地 `npm run build`
- 本地 Electron smoke/UI smoke 可通过。
- 同步到 NixOS 后 `npm run build`。
- 重启 `carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service`。
- 在 NixOS Electron 中跑四个测试任务，确认 output 生成、历史可见、截图无明显 UI 错误。

### GitHub 备份计划

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 开发前状态：工作区干净，`origin/backup/mvp-nixos-20260702-020835` 已存在。
- 本轮不写入真实 API Key；测试通过后再提交并 push。

### 回滚预案

- 若新 UI 影响 Electron 启动，可回滚 Electron renderer 加载路径与 UI 资源目录，恢复 `renderer.ts` 生成页面。
- 若 NixOS 远端启动失败，恢复远端上一版 rsync 内容或从当前 GitHub 备份分支重新部署。

### 本次完成

- 已把 `carvisui` 安装为 Electron 默认 renderer。
- 左上角标题已改为 `Carvis`。
- 已完成 UI 角色映射：主管/文员/设计/调研/技术 -> manager/writer/artist/researcher/engineer。
- UI 通过 preload 接入真实 `getState`、`submitCommand`、`openOutput`、`onState`。
- 右侧 output/history 接入真实 `output/runs/*`，可打开本次输出位置和历史文件夹。
- 自动打开 game preview 改为默认关闭，避免旧预览窗口盖住主 UI。
- NixOS 已同步、构建、重启 `carvis-electron.service`。

### 当前验证

- `npm run typecheck`：通过。
- `npm run build`：通过。
- `npm run electron:ui-smoke`：通过。
- `npm run electron:browser-smoke`：通过。
- `npm test`：通过。
- NixOS `npm run build`：通过。
- NixOS `electron:visual-smoke`：通过。
- NixOS 四个测试任务：均生成 `game-preview.html` 和 `manifest.json`，脚本语法检查通过。
- NixOS 主 UI 截图：`/tmp/carvis-ui-final-main.png`。

## 2026-07-03 / NixOS readback and documentation drift fix / 开工计划

### 本轮目标

- 通过 SSH 读取 NixOS 远端真实运行状态。
- 修正当前文档与真实代码/远端运行形态之间的漂移。
- 明确当前 production flow、provider routing、output/workplace 路径、systemd 状态和测试基线。
- 不修改运行时代码，不碰 API Key。

### 涉及层

- `00-setup`
- `01-electron`
- `02-messagebus`
- `03-agentruntime`
- `04-claudecode`
- `05-mcp`
- `06-workplaces`
- `07-output`
- 接力文档与根 README

### 计划修改

- 更新 `README.md`、各层 `src/*/README.md` 和 `dos/carvis/docs/*` 中的当前状态说明。
- 把旧的 `manager planning -> manager review -> engineer` 描述修正为当前生产流：`manager/writer/artist/researcher` 并行后进入 `engineer`。
- 记录远端 NixOS 的 user service、五个 provider worker、`output/runs/<run>`、`workplaces/runs/<run>` 和 `usage.json` 事实。
- 保留历史条目，但补充“历史状态/兼容代码，不代表当前生产流”的说明。

### 测试计划

- `npm run typecheck`
- `npm run build`
- 如文档之外没有代码变化，不跑完整真实 provider 任务；以 SSH 远端 readback 作为 NixOS 事实核验。

### GitHub 备份计划

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 基线提交：`8210390051741ece05a1a69edb686919069ff567`
- 远端备份分支：`origin/backup/mvp-nixos-20260702-020835`
- 远端状态：已确认 origin 指向同一基线提交。

### 回滚预案

- 文档修正可用 `git revert <本轮提交>` 回滚。
- 若测试失败，不 push 本轮提交，先修正文档或记录阻塞原因。

### 本次完成

- SSH 读取 NixOS 远端：`howtion@192.168.137.59`，主机名 `nixos`。
- 确认 `carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service` active。
- 确认 `carvis-agentruntime.service` 下保留 5 个 `providerWorker` PID。
- 确认最新 run 使用 `workplaces/runs/<run>` 和 `output/runs/<run>`，manifest 包含 `finalReportPath`、`gamePreviewPath` 和五个 role source path。
- 确认最新 engineer usage provider 为 `deepseek-claudecode`，artist usage provider 为 `qwen-openai`。
- 更新入口、架构、层契约、施工计划、测试指标、分层进度、日志和接力文档，修正当前生产流与路径描述。

### 当前验证

- `npm run typecheck`：通过。
- `npm run build`：通过。
- `npm run artist-image-mcp:smoke`：通过。
- `npm test`：通过。

## 2026-07-02

## 2026-07-02 / Real provider role routing with DeepSeek and Qwen / 开工计划

### 本轮目标

- 把 NixOS 常驻 agentruntime 从本地模板生成升级为真实 provider 调用。
- manager 和 engineer 使用 DeepSeek + Claude Code CLI。
- writer、artist、researcher 使用 Qwen3.5-Omni-Plus OpenAI 兼容接口。
- 每个角色运行时注入对应 `skill.md`、`plan.md` 和上游 workplace 内容。
- 不把 DeepSeek/Qwen API Key 写进仓库。

### 涉及层

- `03-agentruntime`
- `04-claudecode`
- `06-workplaces`
- `07-output`
- NixOS systemd/user secret 配置

### 计划修改

- 新增 Qwen OpenAI-compatible client 和 role runner。
- 新增真实 multi-provider role runner：按角色选择 DeepSeek Claude Code 或 Qwen。
- 常驻 `agentruntime/main.ts` 增加真实 provider 模式开关，默认仍可 dry/smoke。
- manager review 使用真实/结构化产物进行 gate；engineer 只在 gate 通过后集成。
- 测试覆盖 provider 路由、prompt 注入和不泄漏密钥。

### 测试计划

- `npm run build`
- `npm run agentruntime:smoke`
- `npm run workplaces:smoke`
- 新增 provider runner smoke
- `npm test`
- NixOS 上配置本地 secret 后运行 DeepSeek/Qwen 真实 smoke。
- NixOS 从 Electron/messagebus 提交一条游戏任务，检查 output 是否包含用户要求、provider 标记和真实产物。

### GitHub 备份计划

- 当前分支：`backup/mvp-nixos-20260702-020835`
- 基线提交：`38ee7e2 backup: add manager review gate`
- 备份分支：继续 push 当前分支，真实密钥只写远端本地文件。

### 回滚预案

- 回滚 provider runner 新增文件和 `agentruntime/main.ts` 的真实 provider 模式。
- 保留已有 manager review gate 和 skill 文件能力。

### 本次完成

- 新增 provider 路由：manager/engineer -> DeepSeek Claude Code，writer/artist/researcher -> Qwen OpenAI-compatible。
- 新增 `src/agentruntime/provider/qwenOpenAi.ts`，按 `QWEN3.5-OMNI-PLUS_CODEX_SETUP.md` 使用 OpenAI 兼容 chat completions。
- 新增 `src/agentruntime/provider/providerWorker.ts`，作为长驻 PID worker，任务结束后进程保留，Runtime 统一 shutdown。
- `AgentRuntime` 新增 `pidTaskInputBuilder` 和 `pidOutput`，让长驻 PID worker 的真实 provider 输出进入 roleRunner。
- `agentruntime/main.ts` 支持 `CARVIS_AGENTRUNTIME_REAL_PROVIDERS=1` 切到真实 provider 模式，并把 `skill.md`、`plan.md`、上游 workplace result 注入 prompt。
- systemd 支持 `EnvironmentFile=`，用于 NixOS 本地 secret env file，不把 API Key 写进仓库。
- 新增 `provider:smoke`，dry 模式验证五角色 provider 路由。

### 当前验证

- 本地 `npm run provider:smoke`：通过。
- 本地 `npm run setup:systemd-smoke`：通过。
- 本地 `npm run agentruntime:smoke`：通过。
- 本地 `npm run runtime-pidagent:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS 默认路由优先 `wlan0`，DeepSeek 和 DashScope 域名均可连通。
- 远端 NixOS `npm run build`：通过。
- 远端 NixOS `CARVIS_CLAUDECODE_REAL_SMOKE=1 npm run claudecode:smoke`：通过，DeepSeek Claude Code 可用。
- 远端 NixOS 五角色全 DeepSeek `CARVIS_REAL_MVP_SMOKE=1 CARVIS_REAL_MVP_USE_SDK=0 npm run mvp:real-smoke`：通过。
- 远端 NixOS 五角色全 DeepSeek SDK warm `CARVIS_REAL_MVP_SMOKE=1 CARVIS_REAL_MVP_USE_SDK=1 npm run mvp:real-smoke`：通过。
- 远端 NixOS `CARVIS_QWEN_REAL_SMOKE=1 npm run provider:smoke`：未通过，Qwen 返回 `invalid_api_key`。
- 已尝试 DashScope 标准域、coding 域、token-plan/trial workspace 域、dashscope-intl 域，均未通过 Qwen key 鉴权。
- ModelScope OpenAI 域 `/chat/completions` 也返回鉴权失败；当前需要有效 DashScope/Workspace API Key 或正确 workspace base URL 才能完成 Qwen real 验收。

## 2026-07-02 / Manager review gate before engineering

### 本轮计划

- 目标：把主管从“开头定规则分任务”升级为“员工交付后复审”，员工都达标后再交给 engineer 制作。
- 涉及层：`03-agentruntime`、`06-workplaces`、文档接力层。
- 计划修改：
  - runtime 编排从 `manager -> writer/artist/researcher -> engineer` 改为 `manager planning -> writer/artist/researcher -> manager review -> engineer`。
  - 新增 `manager_reviewing` run phase。
  - manager 二次运行时读取 writer/artist/researcher 的 workplace 结果，生成审核结论。
  - manager 审核写入 `workplaces/live/manager/review.md`，并追加到 `manager/result.md`，使最终 output 能带着审核 gate 给 engineer。
  - smoke 测试确认 manager 会运行两次，且 engineer 必须在 manager review 之后启动。
- 测试计划：
  - 本地 `npm run build`
  - 本地 `npm run agentruntime:smoke`
  - 本地 `npm run workplaces:smoke`
  - 本地 `npm test`
  - NixOS 同步后 `npm run build` 和 `npm run workplaces:smoke`
  - NixOS 提交任务确认 `manager/review.md` 与 `output/final-report.md` 包含主管复审。
- GitHub 备份计划：测试通过后提交并 push 到当前备份分支。
- 回滚预案：回滚 `manager_reviewing` phase、runtime 二次 manager 执行、`writeManagerReview()` 和相关 smoke 断言。

### 本次完成

- `RunPhase` 新增 `manager_reviewing`。
- Runtime 编排升级为 `manager planning -> writer/artist/researcher -> manager review -> engineer -> output`。
- manager 会二次运行：第一次规划，第二次读取 writer/artist/researcher 的 result 做复审。
- manager review 写入 `manager/review.md`，并追加到 `manager/result.md` 的 `Manager Review Gate`。
- manager review 通过时才进入 `engineer_building`；如果 role runner 返回 `gatePassed: false`，engineer phase 会被跳过。
- manager/engineer skill 更新为：员工复审通过后才交给 engineer 制作。

### 当前验证

- 本地 `npm run build`：通过。
- 本地 `npm run agentruntime:smoke`：通过，覆盖 manager 二次运行、engineer 在 review 后启动，以及 review fail 时跳过 engineer。
- 本地 `npm run workplaces:smoke`：通过，覆盖 `manager/review.md` 和 `Manager Review Gate` 追加。
- 本地 `npm run e2e:smoke`：通过。
- 本地 `npm run ipc:smoke`：通过。
- 本地 `npm run runtime-pidagent:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS 同步后 `npm run build`：通过。
- 远端 NixOS `carvis-agentruntime.service` / `carvis-electron.service`：active。
- 远端提交“writer/artist/researcher 做完后先交给主管审核，通过后再让 engineer 制作最终预览”任务：通过。
- 远端 `workplaces/live/manager/review.md` 包含 `Gate 结论：全部通过，交给 engineer 进入制作集成`。
- 远端 `output/final-report.md` 同时包含 `Manager Review Gate` 和 `Engineer MVP Build List`。
- 远端截图 `/tmp/carvis-manager-review-gate.png`：Manager 面板显示 review gate 写入 `manager/review.md`，Output 文件夹预览正常。

## 2026-07-02 / Agent role skills pack

### 本轮计划

- 目标：给五个 agent 角色各安装 3 个本地 skill，提升协作分工，避免每个角色只各自写文本。
- 涉及层：`03-agentruntime`、`06-workplaces`、文档接力层。
- 计划修改：
  - 新增 agent skill 定义模块，按 manager/writer/artist/researcher/engineer 各提供 3 个中文 skill。
  - workspace 初始化时为每个角色写入 `skill.md`，并让 `plan.md` 带上本角色技能和上下游协作输入。
  - 实时输出流显示 skill 加载、协作输入和验收标准，让 Electron 五个面板能看出角色差异。
  - smoke 测试确认每个 workplace 都有 skill 文件且结果仍能读取。
- 测试计划：
  - 本地 `npm run build`
  - 本地 `npm run workplaces:smoke`
  - 本地 `npm run electron:ui-smoke`
  - NixOS 同步后 `npm run build`
  - NixOS 通过 messagebus 提交原创爬塔卡牌任务，确认五个角色输出含 skill 流和产物文件夹预览。
- GitHub 备份计划：测试通过后提交并 push 到当前备份分支。
- 回滚预案：回滚本轮新增 `skills` 模块、workspace `skill.md` 写入和实时输出改动。

### 本次完成

- 新增 `src/agentruntime/skills/index.ts`，按 manager/writer/artist/researcher/engineer 五个角色各定义 3 个本地 skill。
- 每个 skill 包含 purpose、playbook、handoff、quality gate，明确本角色要消费哪些上游输入、产出哪些下游材料。
- `initializeWorkplaces()` 现在会给每个角色写入 `skill.md`，并把 `plan.md` 改为技能驱动计划。
- `createPublicProgressLines()` 现在会把 skill 加载、协作规则、消费输入、必须产出和验收门槛流式输出到 Electron agent 面板。
- `workplaces:smoke` 增加断言：每个角色 workplace 必须有 `skill.md`，且恰好包含 3 个 installed skills。

### 当前验证

- 本地 `npm run build`：通过。
- 本地 `npm run workplaces:smoke`：通过。
- 本地 `npm run electron:ui-smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS 同步后 `npm run build`：通过。
- 远端 NixOS `carvis-agentruntime.service` / `carvis-electron.service`：active。
- 远端 NixOS `npm run workplaces:smoke`：通过。
- 远端通过 messagebus 提交“原创爬塔卡牌 roguelike，素材自己生成，要求五个 agent 按各自 skills 协作”任务：通过，`output/final-report.md` 和 `output/game-preview.html` 已生成。
- 远端 `workplaces/live/*/skill.md`：五个角色均存在，包含 `Scope Producer`、`Asset Generation Brief`、`Vertical Slice Builder` 等角色 skill。
- 远端截图 `/tmp/carvis-agent-skills.png`：Electron 1000x640 窗口可见五个 agent 面板、Output 文件夹预览和本轮生成产物。

## 2026-07-02 / 1000x640 centered Electron + Chinese agent output + game preview

### 本次完成

- Electron BrowserWindow 改为默认 `1000x640`，居中显示，默认不再 fullscreen/kiosk，避免 1280x720 屏幕边缘截断消息。
- 1000px 宽度下 workspace 保持五列，五个 agent 框同屏全部露出；面板、日志、字体和间距按比例压缩。
- Electron shell 对 `agent.output` 改为追加最近 80 行，五个 agent 框内可持续显示公开进度流。
- agent 输出框改为明显的深色终端样式，显示 `LIVE CLI OUTPUT` 和 `>>> LIVE CLI STREAM [...]`。
- 常驻 `agentruntime/main.ts` 为五个 agent 分别设置中文人设：制作人、叙事设计、美术指导、系统研究、玩法工程师；公开进度和 Macbeth 产出模板均约束为中文输出。
- renderer 每次重绘后自动把 agent 日志和 output 报告预览滚到底部，优先显示最新产出。
- Output 区改为产物文件夹预览：显示 output folder、`final-report.md`、`manifest.json`、五个 role result 路径和 final report 内容预览。
- `writeOutput()` 额外生成 `output/game-preview.html`；Electron 收到 `output.ready` 后可自动打开游戏预览，支持 `CARVIS_GAME_PREVIEW_BROWSER_CMD` 指定 Chrome/Chromium wrapper。
- 保持边界：不显示 Claude Code 隐藏思考链，只显示可公开的进度和输出摘要。
- NixOS 安装并启用 fcitx5 中文输入法：
  - `i18n.inputMethod.type = "fcitx5"`
  - addons: `qt6Packages.fcitx5-chinese-addons`、`qt6Packages.fcitx5-configtool`
  - 环境变量：`GTK_IM_MODULE=fcitx`、`QT_IM_MODULE=fcitx`、`XMODIFIERS=@im=fcitx`
  - 当前会话已启动 `fcitx5 -d`，默认输入法 profile 包含 `pinyin`
- 从真实 NixOS Electron 输入框提交《麦克白》RPG 任务，`output/final-report.md` 和 `output/game-preview.html` 已生成；Chromium wrapper 已配置，但首次拉取 `nixpkgs#chromium` 会受网络下载影响。

### 当前验证

- 本地 `npm run build`：通过
- 本地 `npm run electron:ui-smoke`：通过
- 本地 `npm run electron:browser-smoke`：通过
- 本地 `npm run ipc:smoke`：通过
- 本地 `npm test`：通过
- 远端 NixOS `nixos-rebuild switch`：通过
- 远端 NixOS `fcitx5 -d`：运行中
- 远端 NixOS 真实 Electron 输入《麦克白》RPG 任务：通过，`output/final-report.md` 包含中文设计内容，`output/game-preview.html` 包含 `麦克白 RPG Preview`
- 远端 NixOS `xprop` 复核：Carvis 窗口位置 `140,40`，对应 1280x720 屏幕上的 `1000x640` 居中窗口；截图 `/tmp/carvis-1000x640-window.png` 显示五个 agent 框同屏露出。
- 远端 NixOS 最新代码同步后 `npm run build`：通过，`carvis-electron.service` / `carvis-agentruntime.service` active。
- 补齐原目标任务：提交“受《被掩埋的巨人》主题启发的原创 RPG”中文任务，明确不复制原作角色/情节/地名/独特设定。
- 远端 NixOS 生成 `output/final-report.md` 和 `output/game-preview.html`：通过，报告包含 `版权边界`、`工作标题：雾下余烬`、`主机制：雾与证词`。
- 远端截图 `/tmp/carvis-buried-giant-cn-1000x640.png`：五个 agent 框均有中文输出，Output 区显示产物文件夹预览和 `game-preview.html`。
- 新增《绿毛水怪》主题气质安全原创 galgame 模板：不复制王小波原作角色、情节、独特表达或可识别桥段。
- 远端提交“绿毛水怪 galgame”任务：通过，`final-report.md` 包含 `工作标题：绿潮来信`、`主机制：信件与理解度`，`game-preview.html` 包含 `绿潮来信 Galgame Preview`。
- 远端截图 `/tmp/carvis-green-water-galgame.png`：五个 agent 框均有中文 galgame 输出，Output 区显示产物预览。
- 新增原创爬塔卡牌 roguelike 模板：只参考卡牌构筑、路线爬塔、随机事件、遗物协同等玩法类型，不复制《杀戮尖塔》的名称、角色、卡牌、遗物、敌人、美术、UI 或数值表达。
- 远端提交“原创爬塔卡牌 roguelike，素材自己生成”任务：通过，`final-report.md` 包含 `工作标题：星炉远征`、`主机制：热量与反应`，`game-preview.html` 包含 `星炉远征 Card Roguelike Preview`。
- 远端截图 `/tmp/carvis-deck-tower.png`：五个 agent 框均有中文卡牌爬塔输出，Output 区显示产物预览。

## 2026-07-02 / Electron live renderer IPC

### 本次完成

- Electron BrowserWindow renderer 从静态 snapshot 升级为 live renderer。
- 新增 preload 脚本：renderer 通过 `window.carvis.getState()`、`submitCommand()`、`onState()` 与 Electron 主进程通信。
- `browserMain.ts` 注册 `carvis:get-state` 和 `carvis:submit-command`，仍由 Electron shell 通过 messagebus 提交命令，不绕过 agentruntime。
- `ElectronShell` 新增状态变更订阅，runtime heartbeat、agent lifecycle、agent output、output ready、command submitted 都会推送最新 state 给 renderer。
- Output 入口增加 `openOutput()` IPC，renderer 点击 output 按钮后由 Electron 主进程打开路径。
- `electron:visual-smoke` 增强：真实 Electron 窗口内执行表单 submit，并断言 shell 收到命令；再发布 agent output 并断言 DOM 实时更新；点击 output 入口并断言主进程收到 open 请求。
- 远端 NixOS 重启 `carvis-electron.service` 后，真实 Carvis 窗口仍保持 `1280x720+0+0` 全屏。

### 当前验证

- 本地 `npm run build`：通过
- 本地 `npm run electron:browser-smoke`：通过
- 本地 `npm run electron:ui-smoke`：通过
- 本地 `npm test`：通过
- 远端 NixOS `electron:visual-smoke` with `nixpkgs#electron`：通过，包含 live submit、live DOM update、output open
- 远端 NixOS `npm test`：通过
- 远端 NixOS `CARVIS_REAL_MVP_SMOKE=1 CARVIS_REAL_MVP_USE_SDK=1 ... npm run mvp:real-smoke`：通过 real
- 远端 NixOS `carvis-electron.service` 重启后窗口：`1280x720+0+0`

### 当前未完成

- 本段无阻塞项。

## 2026-07-02 / Claude Agent SDK warm runner + NixOS fullscreen 复验

### 本次完成

- 新增 `@anthropic-ai/claude-agent-sdk` 依赖。
- 新增 `src/agentruntime/claudecode/warmSdk.ts`，通过 SDK `startup()` 预热 Claude Code 子进程，并用自定义 spawn 适配 NixOS `steam-run`。
- 新增 `src/agentruntime/claudecode/warmSdkSmoke.ts` 和 `claudecode:sdk-smoke`。
- 新增 `src/agentruntime/claudecode/warmSdkRoleRunner.ts`，让 `mvp:real-smoke` 可用 `CARVIS_REAL_MVP_USE_SDK=1` 切到 SDK 预热路径。
- 明确 Claude Code CLI `--print --input-format=stream-json` 仍属于单次 print 模式；SDK `WarmQuery.query()` 官方类型说明为每个 warm handle 只能调用一次，因此当前采用“任务前预热、任务后再预热下一轮”的保活策略。
- 复核远端 NixOS Electron：重启后 `Carvis` 窗口仍为 `1280x720+0+0`，DPMS/screen saver 仍关闭。

### 当前验证

- 本地 `npm run build`：通过
- 本地 `npm run claudecode:sdk-smoke`：通过 dry
- 本地 `npm test`：通过
- 远端 NixOS `npm run claudecode:sdk-smoke`：通过 dry
- 远端 NixOS `CARVIS_CLAUDECODE_SDK_REAL_SMOKE=1 ... npm run claudecode:sdk-smoke`：通过 real
- 远端 NixOS `CARVIS_REAL_MVP_SMOKE=1 CARVIS_REAL_MVP_USE_SDK=1 ... npm run mvp:real-smoke`：通过 real
- 远端 NixOS Electron 全屏复核：`Carvis` 窗口 `1280x720+0+0`

### 当前未完成

- SDK warm handle 不是一个 PID 无限多任务接口；每次 query 结束后需要重新 warm 下一轮。

## 2026-07-02 / Electron BrowserWindow 适配

### 本次完成

- 新增 `src/electron/browserWindow.ts`，把现有 HTML renderer snapshot 挂载到 Electron `BrowserWindow`。
- 新增 `src/electron/browserMain.ts`，供真实 Electron runtime 启动窗口时使用；现有 NixOS systemd `electron/main.ts` 入口保持不变。
- 新增 `electron:browser-smoke`，使用 fake Electron module 验证 `BrowserWindow` 参数、sandbox/webPreferences、`loadFile()` 和 `ready-to-show` 后显示窗口。
- 新增 `electron:visual-smoke`，通过外部 Electron runtime 创建真实窗口并捕获 PNG 截图。
- NixOS 上使用 `nixpkgs#electron`，确认 Electron runtime 版本 `v41.7.2`。
- 按用户要求把 Electron 设置为全屏/kiosk；systemd `carvis-electron.service` 现在运行 `dist/electron/runBrowserMain.js` 并调用 NixOS Electron。
- 为避免开机时 Plasma/KWin 抢占面板空间，BrowserWindow 会重复应用 fullscreen/kiosk，systemd unit 写入 `CARVIS_ELECTRON_START_DELAY_MS=8000`。
- `npm test` 已纳入 `electron:browser-smoke`。

### 当前验证

- 本地 `npm run typecheck`：通过
- 本地 `npm run electron:smoke`：通过
- 本地 `npm run electron:ui-smoke`：通过
- 本地 `npm run electron:browser-smoke`：通过
- 本地 `npm test`：通过
- 远端 NixOS `npm test`：通过
- 远端 NixOS `nix shell nixpkgs#electron --command npm run electron:visual-smoke`：通过，生成 `/tmp/carvis-electron-visual-smoke/carvis-electron-visual-smoke.png`
- 远端 NixOS 重启后 `carvis-electron.service`：active，窗口 `Carvis` 尺寸 `1280x720+0+0`
- 远端 NixOS 重启后 WiFi、长亮服务、Carvis 四个 user systemd 服务：均正常
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
