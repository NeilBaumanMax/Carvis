# 07 Output Progress

## 2026-07-02 / Current output folder preview / 当前状态

### 当前事实

- `writeOutput()` 当前会在 output 根目录生成：
  - `final-report.md`
  - `manifest.json`
  - `game-preview.html`
- `manifest.json` 记录每个 role result 的 source path，并包含 `gamePreviewPath`。
- Electron 收到 `output.ready` 后读取 `manifest.json` 和 `final-report.md`，在 Output 区展示整个产物文件夹预览。
- `game-preview.html` 会根据报告内容生成对应预览：
  - `麦克白 RPG Preview`
  - `雾下余烬 RPG Preview`
  - `绿潮来信 Galgame Preview`
  - `星炉远征 Card Roguelike Preview`
  - 默认堂吉诃德预览
- Electron 支持 `CARVIS_GAME_PREVIEW_BROWSER_CMD` 指定 Chrome/Chromium wrapper 打开游戏预览；远端 wrapper 为 `~/bin/carvis-open-chromium`。

### 当前验证

- 本地 `npm run output:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 `output/final-report.md` 和 `output/game-preview.html` 已在多类任务中生成并被 Electron 预览。

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
