# Carvis 总工程需求与施工主指令

> 本文件是 `carvis` 项目的最高优先级施工指令。  
> 后续任何 Codex 接手时，必须先读本文件，再决定开发动作。

## 0. 当前状态覆盖说明（2026-07-03）

本文件下方保留了早期目标和阶段规则；当前实现已经进入可运行 MVP 后的文档漂移修正与质量加固阶段。若早期段落与本节冲突，以本节和当前代码为准。

当前生产事实：

- NixOS 远端运行目录：`~/carvis-remote-smoke`。
- 三个 user service active：`carvis-messagebus.service`、`carvis-agentruntime.service`、`carvis-electron.service`。
- `carvis-agentruntime.service` 使用 `EnvironmentFile=/home/howtion/.config/carvis/agentruntime.env` 注入 secret。
- `agentruntime` 当前 production flow：`created -> parallel_roles_working -> engineer_building -> output_ready -> retaining_agents`。
- `manager`、`writer`、`artist`、`researcher` 并行工作；`engineer` 最后审计合并并生成最终 HTML。
- `manager_planning` / `manager_reviewing` 仍保留在共享类型和历史辅助代码中，但不是当前常驻 production flow。
- 当前 provider routing：manager/writer/engineer 走 DeepSeek Claude Code CLI；artist/researcher 走 Qwen OpenAI-compatible；artist 可通过本地 artist-image MCP wrapper 生成图片资产。
- 常驻 retained PID 是每个角色一个 `providerWorker`，DeepSeek Claude Code 本体仍由 worker 内部按任务调用 CLI print。
- 正式 workplace 路径：`workplaces/runs/<timestamp-request>/<role>/`。
- 正式 output 路径：`output/runs/<timestamp-request>/`。
- 每个角色可写 `usage.json` 记录 provider/model/usage。

---

## 1. 文档定位

本文件同时承担：

- 总需求文档
- 总施工指令文档
- 分阶段推进文档
- 接力开发规则文档
- 进度记录索引文档

新的 Codex 应通过本文件快速确认：

1. 当前项目要做什么
2. 当前阶段不做什么
3. 每个目录允许做什么、不允许做什么
4. 进度和日志应该写到哪里
5. GitHub 备份和回滚机制是什么
6. 每阶段测试指标是什么
7. 每次开工和收尾的固定顺序是什么
8. 完成后需要更新哪些文档

---

## 2. 项目目标

项目名：`carvis`

目标：用 TypeScript 在 NixOS 上运行一个多进程、多 Agent、可视化协同工作系统。

核心能力：

- NixOS 自启动后运行 `src/setup` 启动脚本。
- `setup` 拉起 Electron、messagebus、agentruntime 三类核心进程。
- Electron 通过 messagebus 发送命令、读取状态并显示多个工作隔间。
- 用户在类似 GPT Web 端的输入框中按回车提交命令。
- `agentruntime` 调配多个 Claude Code CLI PID Agent。
- 每个 PID Agent 加载对应角色设定和角色 skills。
- 每个角色 Agent 在自己的 workplace 中工作。
- PID Agent 结束单项任务后不立即关闭，保持挂起，等待统一收尾。
- 所有任务完成后，`agentruntime` 统一关闭 PID Agent。
- 技术 Agent 最后读取各角色 workplace，生成最终产物到 `output/`。
- Electron 可以预览和打开 `output/` 产物。

---

## 3. 最高优先级规则

每次开工前必须读取：

1. `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
2. `dos/carvis/docs/DEV_PROGRESS.md`
3. `dos/carvis/docs/LOG.md`
4. `dos/carvis/docs/GITHUB_ROLLBACK.md`
5. `dos/carvis/docs/TEST_METRICS.md`
6. `dos/carvis/docs/WORKFLOW.md`
7. 当前开发层的进度日志
8. 根目录 `对参考施工文档重构的要求 .txt`

每次开工硬规则：

- 必须先在 `docs/DEV_PROGRESS.md` 写本轮计划。
- 必须先在对应 `docs/progress/layers/*.md` 写本层计划。
- 计划必须写明目标、涉及层、计划修改、测试计划、GitHub 备份计划、回滚预案。
- 必须 push GitHub 开发前备份分支。
- 未写计划或未完成 GitHub 开发前备份前，不允许开始真实代码开发。

每次收尾硬规则：

- 施工完必须先在 `docs/LOG.md` 记录施工情况。
- 测试必须写测试日志。
- 测试不通过必须返工并重新测试，不能上传 GitHub。
- 测试通过后必须检查并修正文档漂移。
- 必须更新 `docs/HANDOFF.md`，写清楚下次要干什么。
- 必须上传 GitHub，并在日志中记录最终提交号和 push 状态。
- 日志必须写明本轮计划回放、实际修改、验证结果、测试日志、测试指标判断、GitHub 状态、回滚判断、下一步。
- 未写日志前，不允许向用户报告“完成”。
- 真实代码开发没有 push 时，不允许把本轮标记为完整完成。

每次真实开发前必须确认：

- 当前分支
- `git status`
- 当前工作区是否有用户未提交改动
- 本轮开发目标
- 本轮会改哪些目录
- 本轮完成后需要更新哪些日志
- 本轮对应测试指标
- 当前 GitHub 远端备份点或没有备份点的原因

禁止事项：

- 不允许跳过主文档直接写代码。
- 不允许不看进度日志就继续开发。
- 不允许越过当前 Phase 乱做后续功能。
- 不允许 Electron 直接启动或杀死 Claude Code PID。
- 不允许 messagebus 执行工具或读写 workplace。
- 不允许 claudecode 封装层承担角色调度。
- 不允许把真实 API Key 写进仓库。
- 不允许回滚用户已有改动，除非用户明确要求。
- 不允许没有 GitHub 备份点就声称具备远端回滚能力。
- 不允许测试失败后仍把本轮标记为完成。
- 不允许缺少测试脚本时写“测试通过”，只能写“未建立脚本”和替代验证。
- 不允许未写开工计划就开始施工。
- 不允许收尾不写施工日志。
- 不允许没有开发前 GitHub 备份就开始真实施工。
- 不允许测试失败后上传 GitHub。
- 不允许测试通过后不修正文档漂移。
- 不允许不写下次接力文档就结束。

---

## 4. 当前产品边界

当前目标是先建立文档和工程边界，再逐步实现可运行 MVP。

当前允许：

- 写施工文档
- 写目录 README
- 写接口类型
- 写本地进程启动脚本骨架
- 写消息协议骨架
- 写最小测试

当前禁止：

- 直接接入真实 DeepSeek API Key
- 直接写复杂 Electron UI
- 直接实现完整 Agent 智能编排
- 直接引入数据库、Redis、远端队列
- 直接做插件市场
- 直接做远程部署

---

## 5. 固定目录边界

### `src/setup`

职责：

- NixOS 自启动入口
- 拉起 `messagebus`
- 拉起 `agentruntime`
- 拉起 `electron`
- 记录启动日志
- 处理退出和重启策略

禁止：

- 不拆解用户任务
- 不启动具体角色 Agent
- 不读写 workplace 业务文件
- 不直接调用 Claude Code CLI

### `src/electron`

职责：

- 显示多个 workplace 隔间
- 显示 PID Agent 状态、心跳、日志摘要
- 提供 GPT Web 类输入框，回车提交命令
- 通过 messagebus 发送用户命令
- 通过 messagebus 订阅 runtime 状态
- 预览和打开 `output/` 产物

禁止：

- 不直接管理 PID
- 不直接写 workspace
- 不直接调用 Claude Code CLI
- 不绕过 messagebus 调用 agentruntime

### `src/messagebus`

职责：

- 本地进程间消息总线
- 接收 Electron 命令
- 转发给 agentruntime
- 广播 Agent 状态、心跳、日志、产物事件
- 定义事件 envelope、requestId、runId、agentId

禁止：

- 不理解任务语义
- 不执行工具
- 不直接读写 workplace
- 不做角色调度

### `src/agentruntime`

职责：

- 多 Agent 管理运行时
- 维护任务队列和调度状态
- 管理 PID Agent 池
- 管理角色加载和 skills 注入
- 管理心跳计时器和监督日志
- 调度总管、文书、美术、调研、技术 Agent 的工作顺序
- 统一关闭全部 PID Agent

禁止：

- 不直接渲染 UI
- 不绕过 messagebus 对外通信
- 不把角色工作文件写到 runtime 根目录
- 不把 provider key 写死在代码里

### `src/agentruntime/claudecode`

职责：

- 封装 Claude Code CLI 启动参数
- 按 DeepSeek 官方 Claude Code 接入文档注入 Anthropic 兼容环境变量
- 启动 PID Agent
- 写入角色 system prompt / skills
- 捕获 stdout / stderr / exit code
- 支持进程保持、复用和最终关闭

禁止：

- 不决定任务拆解策略
- 不决定哪个角色先运行
- 不读写其他角色 workplace

### `src/agentruntime/mcp`

职责：

- 预留 MCP 工具桥接
- 管理工具声明、权限说明和可用状态
- 后续对接 Agent 可调用工具

禁止：

- 当前阶段不实现复杂 MCP server
- 不绕过 agentruntime 直接暴露给 Electron

### `src/agentruntime/messagebus`

职责：

- runtime 侧 messagebus client
- 订阅用户命令
- 发布 Agent 状态、心跳、日志和产物事件

禁止：

- 不重复实现全局 messagebus
- 不承担业务调度

### `src/agentruntime/workplaces`

职责：

- 保存各角色工作目录
- 保存角色输入、过程文件、阶段产物
- 支持 Electron 展示每个隔间状态

建议角色目录：

```text
manager/
writer/
artist/
researcher/
engineer/
```

禁止：

- 不放 runtime 调度代码
- 不放全局配置密钥

---

## 6. 多 PID 角色结构

固定角色顺序：

1. 总管 Agent：先启动，读取用户命令，拆解任务。
2. 文书 Agent：处理文本、文案、结构化说明。
3. 美术 Agent：处理视觉、素材、界面方向。
4. 调研 Agent：处理资料、事实、方案调研。
5. 技术 Agent：最后启动，读取前面各 workplace，生成最终产品到 `output/`。

并发原则：

- 总管完成拆解后，文书 / 美术 / 调研可以并行。
- 技术 Agent 必须等待文书 / 美术 / 调研都完成或明确失败后再启动。
- 角色 PID 可复用，不因单个子任务结束立即退出。
- 全部任务结束后统一 shutdown。

---

## 7. DeepSeek 与 Claude Code CLI

目标组合：

```text
Claude Code CLI + DeepSeek API
```

要求：

- 按 DeepSeek 官方文档使用 Anthropic 兼容端点 `https://api.deepseek.com/anthropic`。
- Claude Code CLI 适配变量使用 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_MODEL`、`ANTHROPIC_DEFAULT_*_MODEL`、`CLAUDE_CODE_SUBAGENT_MODEL`、`CLAUDE_CODE_EFFORT_LEVEL`。
- API Key 只能从环境变量或本地 secret 文件读取。
- 文档中只能写变量名，不写真实值。
- `setup` 可负责加载本地环境变量。
- `claudecode` 封装层负责把环境变量传给子进程。

建议变量名：

```text
ANTHROPIC_BASE_URL
ANTHROPIC_AUTH_TOKEN
ANTHROPIC_MODEL
ANTHROPIC_DEFAULT_OPUS_MODEL
ANTHROPIC_DEFAULT_SONNET_MODEL
ANTHROPIC_DEFAULT_HAIKU_MODEL
CLAUDE_CODE_SUBAGENT_MODEL
CLAUDE_CODE_EFFORT_LEVEL
CARVIS_CLAUDECODE_BIN
CARVIS_WORKSPACE_ROOT
CARVIS_OUTPUT_DIR
CARVIS_HEARTBEAT_MS
CARVIS_AGENT_POOL_SIZE
```

---

## 8. 日志与进度规则

总进度写入：

```text
dos/carvis/docs/DEV_PROGRESS.md
```

每轮施工日志写入：

```text
dos/carvis/docs/LOG.md
```

分层进度写入：

```text
dos/carvis/docs/progress/layers/*.md
```

规则：

- 文档只追加，不覆盖旧记录。
- 开发涉及哪个层，就更新哪个层的进度日志。
- 每轮收尾必须记录验证命令和结果。
- 如果没有运行测试，必须说明未运行原因。
- 每轮真实代码开发前必须按 `docs/GITHUB_ROLLBACK.md` 形成或记录 GitHub 备份点。
- 每轮真实代码开发后必须按 `docs/TEST_METRICS.md` 执行对应测试。
- 每轮收尾必须写回滚判断、回滚命令建议和复测命令。

---

## 9. GitHub 备份与回滚硬规则

详细规则见：

```text
dos/carvis/docs/WORKFLOW.md
dos/carvis/docs/GITHUB_ROLLBACK.md
```

最低要求：

- 开发前记录当前分支、`git status`、基线提交。
- 开发前创建并 push 备份分支。
- 如果没有 GitHub remote，必须在日志中明确“无远端回滚点”。
- 开发后提交并 push 当前开发分支。
- 没有 push，不得把本轮标记为完整完成。
- 回滚优先使用 `git revert`，不得默认使用 `git reset --hard`。

---

## 10. 测试指标硬规则

详细规则见：

```text
dos/carvis/docs/TEST_METRICS.md
```

最低要求：

- TypeScript 代码改动必须执行 `npm run typecheck`。
- 建立测试脚本后，代码改动必须执行 `npm test`。
- 涉及子系统时，必须执行对应 smoke test。
- 没有测试脚本时，必须写清楚未运行原因和替代验证。
- Electron UI 改动必须检查桌面和窄窗口下是否有重叠、溢出、布局跳动。

---

## 11. 当前下一步

当前阶段完成文档脚手架后，下一步应先补根目录 `src/*/README.md` 和最小接口类型，再考虑真实代码。

推荐顺序：

1. `src/setup` README 与启动协议
2. `src/messagebus` README 与事件协议类型
3. `src/agentruntime` README 与 Agent 生命周期类型
4. `src/electron` README 与 UI 状态模型
5. 最小 messagebus smoke test
