# Test Metrics And Acceptance Requirements

## 总原则

每个 Phase 都必须有可执行的验收指标。没有测试脚本时，必须先写清楚手动验证命令和预期输出，不能只写“已完成”。

测试日志必须记录每一次失败和复测。不能只保留最后一次通过结果。

## 全局最低测试门槛

每轮代码开发收尾必须至少执行：

```text
npm run typecheck
```

当项目具备测试脚本后，每轮代码开发还必须执行：

```text
npm test
```

如果改动涉及具体子系统，还必须执行对应 smoke test：

```text
npm run setup:smoke
npm run messagebus:smoke
npm run agentruntime:smoke
npm run electron:smoke
npm run claudecode:smoke
```

尚未创建脚本时，不得假装通过；日志必须写明“脚本未建立”。

## Phase 0 文档与边界

验收指标：

- 主施工文档存在
- 架构文档存在
- 施工计划存在
- GitHub 回滚策略存在
- 测试指标文档存在
- 分层进度日志存在
- 文档中明确 TypeScript、NixOS、Electron、messagebus、agentruntime、Claude Code CLI、DeepSeek 边界

验证方式：

```text
find dos/carvis -type f | sort
```

## Phase 1 setup

验收指标：

- setup 能按顺序拉起 messagebus、agentruntime、electron
- 任一子进程启动失败时，setup 能记录失败并退出或重试
- setup 不直接启动角色 Agent
- setup 不直接调用 Claude Code CLI

最低测试：

```text
npm run typecheck
npm run setup:smoke
```

建议 smoke 指标：

- 启动顺序事件数量等于 3
- 启动失败能返回非零状态
- 环境变量加载不打印真实密钥

## Phase 2 messagebus

验收指标：

- 支持 `command.submitted`
- 支持 `runtime.heartbeat`
- 支持 `agent.output`
- 支持 `output.ready`
- 每个事件都有 `eventId`、`timestamp`、`source`、`requestId` 或 `runId`
- messagebus 不执行任务、不读写 workplace

最低测试：

```text
npm run typecheck
npm run messagebus:smoke
```

建议 smoke 指标：

- 单条命令可从 Electron mock 发送到 agentruntime mock
- heartbeat 可从 agentruntime mock 广播到 Electron mock
- 断开连接有明确错误事件

## Phase 3 Electron

验收指标：

- 首屏直接显示工作隔间，不做营销页
- 至少显示 manager、writer、artist、researcher、engineer 五个隔间
- 输入框回车能发送 `command.submitted`
- 能展示 Agent 状态、PID、心跳时间、最近输出
- 收到 `output.ready` 后能展示可打开入口

最低测试：

```text
npm run typecheck
npm run electron:smoke
```

建议 UI 指标：

- 桌面视口无重叠
- 移动或窄窗口下文本不溢出
- 五个隔间状态更新不会导致布局跳动

## Phase 4 agentruntime

验收指标：

- 当前 production flow 中 manager、writer、artist、researcher 可并行启动
- 技术 Agent 等待前置四个角色完成后启动
- PID Agent 完成子任务后进入 `retained`
- 全部任务结束后统一 shutdown
- 心跳包含 active/idle/retained PID 数量和 queueDepth
- 真实 provider 模式下每个角色保留一个 `providerWorker` PID
- 角色 provider/model/usage 写入 `usage.json`

最低测试：

```text
npm run typecheck
npm run agentruntime:smoke
```

建议 smoke 指标：

- role flow 顺序可断言
- 并发角色数量可断言：manager/writer/artist/researcher 并行，engineer 在后
- shutdown 后无残留 PID
- heartbeat 周期在配置范围内

## Phase 5 Claude Code CLI

验收指标：

- 使用 DeepSeek 官方 Anthropic 兼容变量
- `ANTHROPIC_BASE_URL` 默认是 `https://api.deepseek.com/anthropic`
- 不把真实 `ANTHROPIC_AUTH_TOKEN` 写入日志或仓库
- 可启动测试子进程
- 可捕获 stdout、stderr、exit code
- 可在不退出 PID 的情况下标记任务完成
- 可统一关闭 PID

最低测试：

```text
npm run typecheck
npm run claudecode:smoke
```

建议 smoke 指标：

- 缺少 token 时给出明确配置错误
- mock claude 命令可被启动
- 非零 exit code 被归类为 `agent_exit_nonzero`
- timeout 被归类为 `agent_timeout`

## Phase 6 workplaces

验收指标：

- 每个角色只能写自己的 workplace
- engineer 可读前置角色 workplace
- engineer 最终只能写 `output/`
- 每个正式 workplace 位于 `workplaces/runs/<run>/<role>/`
- 每个 workplace 有 `input.md`、`skill.md`、`plan.md`、`log.md`、`result.md`、`common/`、`skills/`、`task_state.json`、`handoff_to_engineer.json`、`evidence_index.json` 或等价结构

最低测试：

```text
npm run typecheck
npm run workplaces:smoke
```

## Phase 7 output

验收指标：

- output 有 `manifest.json`
- output 有最终报告或最终产物
- 正式 output 位于 `output/runs/<run>/`
- 游戏或 HTML 任务应有 `game-preview.html`
- 生成完成后广播 `output.ready`
- Electron 可预览或打开 output

最低测试：

```text
npm run typecheck
npm run output:smoke
```

## Phase 8 集成验收

验收指标：

- 一条用户命令能走完整链路
- manager、writer、artist、researcher、engineer 状态可见
- output 产物可见
- 全部 PID 可统一关闭
- 日志记录完整 runId

最低测试：

```text
npm run typecheck
npm test
npm run e2e:smoke
```

## 测试日志格式

每轮 `docs/LOG.md` 必须写：

```text
### 验证结果

- `npm run typecheck`：通过 / 失败 / 未运行，原因
- `npm test`：通过 / 失败 / 未运行，原因
- `<subsystem smoke>`：通过 / 失败 / 未运行，原因

### 测试日志

- 第 1 次：`<command>`，通过 / 失败，摘要
- 修复动作：<change>
- 第 2 次：`<command>`，通过 / 失败，摘要

### 测试指标判断

- 本轮涉及层：<layers>
- 应执行测试：<commands>
- 实际执行测试：<commands>
- 未执行项及原因：<reason>
```

## 测试失败循环

如果测试失败，必须按以下循环处理：

```text
测试失败 -> 记录失败 -> 修复 -> 重新测试 -> 记录复测 -> 直到通过或阻塞
```

阻塞时必须写：

```text
阻塞原因：<reason>
已尝试修复：<changes>
当前失败命令：<command>
下一步需要：<action>
GitHub 状态：未上传可用版本 / 已上传失败现场分支
```
