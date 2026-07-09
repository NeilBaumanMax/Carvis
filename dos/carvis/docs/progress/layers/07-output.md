# 07 Output Progress

## 2026-07-09 / macOS 部署 / 当前状态

- `output:smoke` 通过
- 三进程完整链路生成完整的 `manifest.json` + `report.md`（5 角色结果）
- output 目录路径：`output/runs/<timestamp-request>/`

---

## 2026-07-03 / NixOS readback and drift fix / 开工计划

### 当前目标

- 修正 output 文档中正式运行目录和 Electron 打开能力的过期描述。

### 计划改动

- 明确正式运行输出为 `output/runs/<timestamp-request>/`。
- 记录 manifest 包含 `finalReportPath`、`gamePreviewPath` 和五个角色 result source path。
- 记录 Electron 当前可以展示 output folder preview，并可通过主进程打开当前 run 的 `game-preview.html`。

### 验收指标

- 文档与远端最新 `output/runs/.../manifest.json` 一致。
- `npm run typecheck` 和 `npm run build` 通过。

## 2026-07-02 / Current output folder preview / 当前状态

### 当前事实

- `writeOutput()` 当前会在每个 run 的 output 目录生成：
  - `final-report.md`
  - `manifest.json`
  - `game-preview.html`
- 正式路径为 `output/runs/<timestamp-request>/`。
- `manifest.json` 记录 `finalReportPath`、`gamePreviewPath` 和每个 role result 的 source path。
- Electron 收到 `output.ready` 后读取 `manifest.json` 和 `final-report.md`，在 Output 区展示整个产物文件夹预览。
- 当 engineer 输出 fenced `html` 时，`game-preview.html` 直接采用 engineer 的完整 HTML；否则才使用 fallback preview。
- Electron 支持 `CARVIS_GAME_PREVIEW_BROWSER_CMD` 指定 Chrome/Chromium wrapper 打开游戏预览；远端 wrapper 为 `~/bin/carvis-open-chromium`。

### 当前验证

- 本地 `npm run output:smoke`：通过。
- 本地 `npm test`：通过。
- 远端最新 `output/runs/.../manifest.json` 包含绝对 `finalReportPath`、`gamePreviewPath` 和五个 role result `sourcePath`。

## 2026-07-02 / Local MVP smoke / 本次完成

### 当前目标

- 建立最小 output manifest 和 final report，支撑 Electron output ready 展示。

### 本次完成

- 新增 `src/output/index.ts`
- 新增 `src/output/smoke.ts`
- 新增 `npm run output:smoke`
- e2e smoke 会生成 `final-report.md` 和 `manifest.json`
- Electron shell 可看到 output ready 入口

### 测试基线

- 本地 `npm run output:smoke`：通过
- 本地 `npm run e2e:smoke`：通过
- 远端 NixOS `npm run output:smoke`：通过
- 远端 NixOS `npm run e2e:smoke`：通过

### 未完成

- Electron 尚未实现真实打开文件。
- output 当前在 smoke 临时目录生成，尚未接入正式运行目录。

## 2026-07-01 / Phase 0 / 初始化

### 当前目标

固定最终产物输出和 Electron 预览边界。

### 本次完成

- 明确技术 Agent 最终生成产物到 `output/`
- 明确 output ready 事件由 agentruntime 经 messagebus 广播
- 明确 Electron 负责预览和打开产物

### 当前状态

- 已完成：文档边界
- 进行中：无
- 未完成：output 目录、manifest、预览协议

### 下一步

- 建立 `output/` 目录约定
- 定义 `output.ready` payload

## 2026-07-02 / NixOS MVP 验收 / 补充

### 本次完成

- `e2e:smoke` 和 `mvp:real-smoke` 均生成 `manifest.json` 与 `final-report.md`。
- Electron shell 能收到 `output.ready` 并在 state 中显示产物入口。
- NixOS 真实 smoke 验证最终报告包含五角色真实 Claude Code 输出。

### 测试基线

- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- Electron 仍是 shell/mock 状态模型，尚未实现真实桌面窗口中的文件打开动作。
- 正式运行目录和持久化 output 清理策略还未定稿。
