# Carvis 多 Agent 连续测试记录

> 记录目标：连续测试并优化 Carvis 的五角色协作流程，重点观察 manager 分配、writer 故事性、artist 生图效率、engineer 集成质量、最终浏览器截图是否满足需求。

## 测试方法

- 测试环境：NixOS 远程机 `~/carvis-remote-smoke`
- 服务：`carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service`
- 成功标准：最终 `output/runs/<本次时间>/game-preview.html` 能由浏览器打开，截图不是旧产物；玩法、题材、素材和交互符合本次任务。
- 记录原则：记录可公开的流程观察、耗时、输出路径和优化判断，不记录模型隐藏思考。
- 版本策略：每轮关键优化后提交 GitHub 备份。

## 本轮测试清单

| 编号 | 用户任务 | 目标类型 | 状态 |
|---|---|---|---|
| 测试 1 | 生产一个王尔德《快乐王子》灵感的 galgame | 剧情分支 / 视觉小说 | 待开始 |
| 测试 2 | 按王小波《红拂夜奔》写一个冒险闯关游戏 | 冒险闯关 / 关卡 | 待开始 |
| 测试 3 | 按 The Bazaar 重写一个类似玩法游戏 | 商店/物品构筑 / 自动战斗 | 待开始 |
| 测试 4 | 整理 `sdyzjx/open-yachiyo` 仓库脚手架和文件用途，HTML 展示 | 仓库分析 / 文档可视化 | 准备中 |

## 已做的测试前优化

时间：2026-07-02

### 协作流程优化

- manager 增强：必须先输出按角色任务书，明确 writer / artist / researcher / engineer 的交付格式。
- manager 复审策略保持：只阻断异常、空产物、明显偷懒、provider 错误；可整合差异交给 engineer 统一。
- writer 增强：必须输出可数据化的 scene / choice / ending，至少 4 个选择节点，每个节点包含中文对白、后果和状态变化。
- artist 收敛：少写长篇设定，重点输出 2-4 张会被最终 HTML 使用的关键图片资产、用途、构图、UI 安全区和 prompt。
- engineer 增强：标题页和至少一个可玩场景必须明显使用 artist 生成的本地图片，只有图片失败时才用 fallback。

### 当前待验证点

- 最新提示词是否让 writer 故事性提升，而不是只写结构。
- artist 是否减少长篇报告并把时间转到真实生图。
- 2 路并发生图是否稳定，不触发 Qwen image 429。
- manager 是否能把“可整合差异”转成 engineer 可执行契约。
- 最终 Electron / 浏览器是否只打开本次 `output/runs/.../game-preview.html`。

## 测试 1：王尔德《快乐王子》灵感 galgame

### 任务输入

开始时间：2026-07-02 22:23:20 CST

请求 ID：`req-test1-happy-prince-galgame-*`

摘要：生成一个原创中文 galgame，主题灵感来自王尔德《快乐王子》的公版主题：牺牲、城市冷暖、旁观者与行动者、华丽外表和内在慈悲。要求不复制原文句子和具体表达。

关键约束：

- manager 先写按角色任务书，明确故事支柱、版权边界、writer 场景/选择数量、artist 图片数量、researcher 状态字段、engineer 验收标准。
- writer 必须写强故事性原创角色、至少 4 个选择节点、中文对白、选择后果、至少 3 个结局，并输出可数据化材料。
- artist 少写长篇设定，重点生成 2-4 张关键图片资产。
- engineer 必须做可玩的 HTML galgame，标题页和至少一个场景必须实际引用本次 `assets/` 图片。
- 最终只能打开本次 `output/runs/.../game-preview.html`。

### 时间线

- 22:23:20：测试开始，提交到远程 messagebus。
- 22:23:39：远程返回 delivered=1。
- 22:24:39 左右：远程 run 目录已创建，manager 仍在 DeepSeek Claude Code 首轮规划中；writer/artist/researcher/engineer 仍为 pending，占位文件未产出。
- 22:29 左右：manager 首轮完成，writer / artist / researcher 并行角色完成；writer `result.md` 约 16.7 KB，artist `result.md` 约 10.6 KB，researcher `result.md` 约 8.8 KB。artist 已通过 MCP 生成 4 张本地图片。
- 22:29 左右：manager 进入复审/engineer 前阶段，engineer 仍为 pending。

### 产物

- run 目录：`workplaces/runs/20260702-142339-req-test1-happy-prince-galgame-17830-测试1：请五个角色协作生成一个原创中文-galgame，主题灵感`
- NixOS 产物路径：
  - `~/carvis-remote-smoke/output/runs/20260702-142339-req-test1-happy-prince-galgame-17830-测试1：请五个角色协作生成一个原创中文-galgame，主题灵感/game-preview.html`
  - `engineer/result.md` 约 43KB，包含完整 fenced HTML。
- HTML 静态检查：
  - 标题：`星磁塔·明煌夜话`
  - 包含 4 个选择节点与 3 个结局文本。
  - 实际引用本次 artist assets：`assets/artist-title-bg.png`、`assets/artist-tower-interior.png`、`assets/artist-city-night.png`、`assets/artist-ending-hope.png`。
- 已生成图片：
  - `assets/artist-title-bg.png`
  - `assets/artist-tower-interior.png`
  - `assets/artist-city-night.png`
  - `assets/artist-ending-hope.png`

### 截图验收

- 22:40 第一次真实桌面截图失败标准：截到的是 Carvis 主窗口，不是游戏窗口。
- 22:42 修复 Electron 打开逻辑后重新触发 `output.ready`，NixOS 桌面截图成功：
  - 远端截图：`/tmp/carvis-test1-game-window.png`
  - 本机查看副本：`/tmp/carvis-test1-game-window.png`
  - 截图显示独立游戏预览窗口，标题页为“星磁塔 / 明煌夜话”，背景图加载成功，开始按钮可见。
- 结论：测试 1 的“最终打开浏览器/预览窗口截图”验收通过。

### 问题与优化点

- writer 产量明显提升，已经写出完整角色、场景、选择和结局数据；但初步观察题材漂移到赛博塔都市，和《快乐王子》的“城市雕像/贫富冷暖/牺牲”主题关系变弱，需要后续优化 manager：要求保留题材核心意象但换表达，而不是完全换到赛博题材。
- artist 仍先写了较长视觉圣经，但 MCP 产图成功；后续可进一步要求 artist 文本上限，减少视觉报告字数。
- 问题 1：engineer 初始长时间没有输出，因为 DeepSeek Claude Code 子进程收到 manager/writer/artist/researcher 全量上游长文后卡住，`engineer/result.md` 长时间只有初始化行。
- 修复 1：运行时压缩 manager review / engineer handoff 上游材料，只保留 provider header、标题、资产清单、状态/结局规则、代码块和尾部关键结论。
- 问题 2：provider worker 超时/重启异常可能让 `currentRun` 占住，后续队列只初始化不继续输出。
- 修复 2：pid agent 超时会终止子进程；role provider 异常会写成 `PROVIDER_ERROR`；整轮 run 异常会释放 `currentRun` 并继续 drain queue。
- 问题 3：默认用 `electron.shell.openPath(gamePreviewPath)` 在 NixOS 上不稳定，实际截图只看到 Carvis 主窗口。
- 修复 3：Electron 默认改为内部新建 `Carvis Game Preview` 窗口并直接 `loadFile(game-preview.html)`，不依赖 xdg-open/Firefox。

## 测试 2：王小波《红拂夜奔》灵感冒险闯关游戏

### 任务输入

开始时间：2026-07-02 23:00 左右。

请求 ID：`req-test2-hongfu-adventure-platformer-1783004450595`

摘要：生成一个原创中文冒险闯关游戏，主题气质受到王小波《红拂夜奔》中“荒诞、自由、逃离秩序、机智反抗、历史戏仿”的启发，但不复制原文句子、原作角色、独特情节或专有表达。

关键约束：

- manager 必须明确原创世界观、版权边界、关卡数量、角色目标、artist 图片数量、researcher 玩法字段、engineer 验收标准。
- writer 必须写强故事性的原创主角、反派和同伴；至少 4 个关卡，每关有目标、阻碍、对白、过关条件和失败反馈。
- researcher 必须设计移动/跳跃/互动/收集/警戒或追捕等状态字段，给出胜负条件和平衡检查。
- artist 默认生图，生成 2-4 张关键图片资产。
- engineer 必须制作可玩的单文件 HTML，包含键盘控制、碰撞/收集/胜负反馈，并引用本次 artist assets。

### 时间线

- 23:00 左右：测试 2 已提交到 NixOS messagebus，等待五角色执行。
- 23:02 左右：manager 首轮完成，`result.md` 约 15KB；researcher 完成，`result.md` 约 7.5KB；writer 和 artist 仍在并行执行。
- 23:04 左右：writer 完成，`result.md` 约 11.6KB；artist 完成，`result.md` 约 9.6KB；artist 默认生图成功，生成 4 张本地图片。
- 23:16 左右：修复“engineer 超时仍生成报告页冒充 game-preview.html”的问题后，提交测试 2 重跑，请求 ID：`req-test2-hongfu-adventure-platformer-retry-1783005419401`。

### 产物

- 已生成图片：
  - `assets/artist-title-bg.png`
  - `assets/artist-level-bg.png`
  - `assets/artist-boss-face.png`
  - `assets/artist-key-art.png`

### 截图验收

失败记录：

- 23:11 左右：NixOS 生成了 `output/runs/.../game-preview.html`，但检查发现它不是可玩游戏，而是 fallback 的汇总报告页。
- 直接原因：engineer provider 超时，`engineer/result.md` 只有 `PROVIDER_ERROR: pid agent engineer task timed out after 360000ms`；outputWriter 仍然用 final report fallback 渲染 `game-preview.html`。
- 结论：这次不能算通过，需要重跑。

### 问题与优化点

- outputWriter 不能在游戏/HTML 任务中用报告页冒充 `game-preview.html`；如果 engineer 没有真实 fenced HTML，应判失败，不发布成功预览。
- provider 超时不能直接结束本角色；应该进入下一次尝试，并重新创建 provider worker。
- 23:28 左右：测试 2 重跑产出本轮 `game-preview.html`，artist 成功生成 4 张 PNG，engineer 输出约 55KB HTML，但截图验收失败：Electron 预览窗口标题为“逃离长安坊：无号者”，画面几乎全黑。
- 直接原因：engineer HTML 运行时语法错误，脚本内重复声明变量：`const keys = {}` 用于键盘输入，随后 `let keys = []` 用于关卡钥匙；浏览器报 `Identifier 'keys' has already been declared`，JS 停止执行导致黑屏。
- 23:29-23:31：新增两层门禁：
  - `validateRealProviderOutput()` 对 engineer fenced HTML 提取 `<script>` 并执行 `new Function(script)` 语法检查，失败触发 provider retry。
  - `outputWriter` 写 `game-preview.html` 前兜底检查 HTML script 语法，失败不发布 output.ready。
- 23:30：本地 `npm run build` 通过；`npm run output:smoke` 通过，覆盖“重复声明导致黑屏 HTML 必须拒绝”。
- 23:31：同步到 NixOS，远端 `npm run build && npm run output:smoke` 通过，`carvis-agentruntime.service` / `carvis-electron.service` 重启后 active。
- 23:31：Electron 控制台布局修复生效，1000x640 下底部输入框和 Run 按钮完整露出，不再整体页面滚动错位；截图：本地 `/tmp/carvis-layout-fixed.png`。
- 23:32：使用正确的 `command.submitted` 事件提交测试 2 修复重跑，run 目录：
  - `workplaces/runs/20260702-153234-req-test2-hongfu-adventure-platforme-测试2修复重跑：请五个角色协作生成一个原创中文冒险闯关游戏，主题`
- engineer handoff 进一步压缩：engineer 阶段只接收 manager 复审结论、writer 关卡/对白摘要、artist 资产路径、自审摘要、researcher 机制字段摘要；不再把上游长文整包塞入。
- 23:44：测试 2 修复重跑生成新 `game-preview.html`：
  - `output/runs/20260702-153234-req-test2-hongfu-adventure-platforme-测试2修复重跑：请五个角色协作生成一个原创中文冒险闯关游戏，主题/game-preview.html`
  - HTML 大小约 32KB，包含 1 个 canvas、1 个 script。
  - `new Function(script)` 语法检查通过。
  - 代码包含 4 个关卡、`inputKeys` 键盘状态、WASD/方向键/Space、收集物、敌人巡逻/追捕、R 重试、结局页。
  - 图片引用包含 `assets/artist-title-screen.png`、`assets/artist-level-1-market.png`、`assets/artist-character-hero.png`、`assets/artist-enemy-guard.png`，artist 本轮 4/4 生成成功。
- 23:45 截图验收：
  - 截图：本地 `/tmp/carvis-test2-fixed-final.png`。
  - 截图可见真实游戏场景、背景图、HUD、玩家/敌人/出口、失败反馈“规矩抓住了你”，不再黑屏。
  - 仍有不足：最终截图停在失败态，不是标题页或正常游玩态；远端缺少 `xdotool`，无法稳定注入 R/方向键做动态操作截图。静态代码确认标题页、开始、R 重试、4 关和输入控制存在。

## 测试 3：The Bazaar 类玩法重写

### 任务输入

开始时间：2026-07-02 23:48 左右。

目标：五角色协作生成一个原创中文浏览器游戏，玩法结构参考 The Bazaar 一类的“商店经营 / 物品组合 / 回合自动战斗 / 经济抉择 / roguelike 成长”框架，但必须原创化。

版权边界：

- 不复制 The Bazaar 的角色、英雄、物品名称、UI 布局、图标风格、文本、数值表和独特表达。
- 可以抽象借鉴高层机制：买卖、升级、合成、背包格、回合自动战斗、随机事件、连锁触发、经济取舍。
- 最终产物必须是原创中文主题、原创资产和原创命名。

关键约束：

- manager 要先把任务拆成 writer / artist / researcher / engineer 的清晰分工，并明确原创边界、MVP 范围、胜负条件和最终浏览器截图验收标准。
- writer 必须写强故事性：原创商人主角、竞争者、地点、回合事件、商品传闻、胜败文案；不能只写物品表。
- researcher 必须设计经济与自动战斗状态字段：金币、声望/热度、物品槽位、商店刷新、物品触发时机、战斗回合、敌人血量/护盾/伤害。
- artist 默认生图，少写长文，生成 2-4 张关键资产：标题图、商店背景、物品/角色/敌人资产；需要给 engineer 明确相对路径。
- engineer 必须输出完整 fenced HTML：可打开、可玩，包含商店购买/刷新/升级、物品栏、开始战斗、自动战斗日志、胜负反馈、下一天/重开；必须实际引用 artist 本轮 assets。
- HTML 脚本必须通过 `new Function(script)` 语法检查，不允许黑屏。

### 时间线

- 23:48：通过 NixOS Electron 输入框提交测试 3，run 目录：
  - `workplaces/runs/20260702-154848-req-test3-bazaar-like-autobattler-17-测试3：请五个角色协作生成一个原创中文浏览器游戏，玩法结构参考-`
- 23:52 左右：writer / artist / researcher / manager 产物完成，manager 复审输出 `GATE_PASSED: true`。
- artist 本轮生图成功，生成 4 张资产，保留了“少写长文、默认产图、engineer 可嵌入”的方向。
- engineer 第 1 次尝试 360 秒超时；runtime 自动进入第 2 次尝试，没有直接发布伪成功输出。
- 00:05：engineer 第 2 次完成，`engineer/result.md` 约 51KB，输出完整 fenced HTML。
- 00:05：系统写出本次 `game-preview.html`，并打开 Electron 内部预览窗口。

### 产物

- HTML：
  - `output/runs/20260702-154848-req-test3-bazaar-like-autobattler-17-测试3：请五个角色协作生成一个原创中文浏览器游戏，玩法结构参考-/game-preview.html`
  - 大小：约 50.8KB。
  - 包含 1 个 `<script>`，`new Function(script)` 语法检查通过。
  - 无 `<canvas>`，主要使用 DOM/CSS + artist PNG 背景/角色图实现界面。
- 图片资产：
  - `assets/artist-title-bg.png`
  - `assets/artist-shop-bg.png`
  - `assets/artist-hero-portrait.png`
  - `assets/artist-enemy-spritesheet.png`
- 静态关键词检查命中：
  - 购买、刷新、升级/出售、开始战斗、下一天、金币、商店、物品栏、战斗日志。

### 截图验收

- 00:05 截图：`/tmp/carvis-test3-screen.png`
  - 可见游戏已进入第 3 天商店/战斗界面。
  - HUD 显示天数、金币、声望、耐久。
  - 商店区可见物品卡和购买按钮，货舱有 6 格，战斗区可见角色图，底部有开始战斗/继续航行/重新开始按钮。
  - 问题：1000x640 预览窗口在 1280x720 + 底部任务栏环境下底部贴得过低，按钮底部被任务栏遮挡一截。
- 00:07 修复后截图：`/tmp/carvis-test3-window-fixed.png`
  - Electron 预览窗口改为按 primary display `workArea` 计算尺寸和居中位置。
  - 标题页、artist 标题图和“起航”按钮正常显示，窗口底边位于任务栏上方，不再被遮挡。

### 问题与优化点

- 当前复杂商店/自动战斗任务仍会给 engineer 较大压力，第 1 次 engineer 超时说明上游输入还偏重。
- 已进一步优化 engineer handoff：
  - engineer 只接收可用的 `manager/review.md`，不再同时接收 manager 初稿和复审长文。
  - 增加 `Engineer implementation brief`：先做最小完整可玩 HTML，不复述上游报告；商店/自动战斗任务明确 8-12 个物品、3 个敌人、商店刷新池、物品栏、战斗循环、日志、下一天、重开。
  - writer/researcher 摘要增加商店、金币、刷新、升级、出售、触发、自动战斗、护盾、伤害等关键词，减少无效长 JSON/长文。
- Electron 布局修复：
  - 控制台 `.app` 从错误的 4 行 grid 改为 header/main/footer 三行，`main` 内部固定角色面板区，Output/Events 内滚动，底部输入栏不再被挤出屏幕。
  - 主窗口和游戏预览窗口都使用 `screen.getPrimaryDisplay().workArea` 约束尺寸，避免 1280x720 下被系统任务栏遮挡。

## 测试 4：open-yachiyo 脚手架整理 HTML

### 任务输入

新增时间：2026-07-02 22:26 左右。

用户要求：整理 `https://github.com/sdyzjx/open-yachiyo` / `https://github.com/sdyzjx/open-yachiyo.git` 里面有什么、脚手架怎么做、各个文件什么用，并用 HTML 展示。

执行方式：

- 不在本机分析。
- NixOS 远程机自行执行 clone：
  - 仓库路径：`~/carvis-test-inputs/open-yachiyo`
  - 摘要路径：`~/carvis-test-inputs/open-yachiyo-summary.md`
- 后续把 NixOS 生成的仓库快照摘要交给 Carvis 五角色，让它们输出 HTML 展示。

### 时间线

- 22:26 左右：NixOS 远程 clone 完成，生成 `open-yachiyo-summary.md`，共 1022 行。
- 22:27:58：测试 4 已提交到 NixOS Carvis messagebus，`delivered=1`；由于测试 1 正在运行，测试 4 等待队列执行。

### 产物

待记录。

### 截图验收

待记录。

### 问题与优化点

- 该任务不是游戏生成，而是仓库结构分析；需要 manager 改变验收标准为“文档准确性、脚手架图谱、文件用途表、HTML 信息架构”，不能套用游戏验收。

## 汇总优化池

### 流程优化

- 22:32 左右发现测试 1 的 engineer 没有真实输出：`engineer/result.md` 只有初始化行，DeepSeek Claude Code 子进程仍在运行，后续队列被阻塞。
- 直接原因：engineer 输入包含 manager/writer/artist/researcher 全量长文，上游包过大，DeepSeek CLI 长时间无返回。
- 修复方向：运行时对 manager review / engineer handoff 做摘要压缩，只保留 provider header、标题、资产清单、状态/结局规则、代码块和尾部关键结论；同时给 Claude Code 子进程加进程组超时终止，避免残留进程堵队列。

### 提示词优化

- 文档/仓库分析任务不能套用“游戏、关卡、结局、玩法”模板；engineer 硬要求需要按任务类型分支。
- artist 生图效果好，特别是 open-yachiyo 文档 HTML 里的 UI 背景、目录图标、架构流程图、状态徽章对说明有帮助；保留并默认开启 artist-image-mcp。
- artist 优化方向不是关闭生图，而是“少写废话、默认轻量限量、图片要能被 engineer 嵌进 HTML”：文档任务 1-4 张 UI/图示资产，游戏任务 2-4 张关键场景/角色/CG 资产。

### 工程优化

- 22:34 左右：修复已同步到 NixOS，远端 `npm run build` 通过，`carvis-agentruntime.service` 和 `carvis-electron.service` 已重启为 active。
- 22:34 左右：测试 1 已重新提交到 NixOS messagebus，requestId: `req-test1-happy-prince-galgame-retry-1783002839881`。
- 22:42 左右：继续修复 runtime 异常释放与 Electron 内部打开 game-preview；远端 `npm run build` 通过，`carvis-electron.service` active。
