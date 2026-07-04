# CODEX START HERE: Carvis 多 Agent 可视化系统施工说明

> 本文件是新的 Codex / Coding Agent 接手 `carvis` 时必须先读的入口文档。  
> 目标是在 macOS 上建设一个多进程调配多个 Claude Code Agent 的可视化协同工作系统。

---

## 0. 项目定位

项目名：`carvis`

项目目标：

用 TypeScript 写主体代码，通过 macOS 自启动脚本拉起本地多进程系统，让 Electron 前端通过消息总线观察和控制 `agentruntime`，由 `agentruntime` 调度多个 Claude Code CLI PID Agent 在独立 workplace 中协同完成任务，最终由技术 Agent 汇总产物到 `output/`，Electron 负责预览和打开产物。

启动方式：

```text
macOS 上使用 launchd User Agent 实现开机自启，或通过 npm start 手动启动。
```

启动后固定拉起三类进程：

```text
src/setup        -> macOS 启动与进程拉起
src/electron     -> 可视化前端
src/messagebus   -> 本地消息总线
src/agentruntime -> 多 Agent 管理运行时
```

`agentruntime` 内部继续按现有目录拆分：

```text
src/agentruntime/claudecode  -> Claude Code CLI PID Agent 封装
src/agentruntime/mcp         -> 后续 MCP 工具桥接
src/agentruntime/messagebus  -> runtime 侧消息总线适配
src/agentruntime/workplaces  -> 各角色工作隔间与工作目录
```

---

## 1. 当前施工目标

当前只做施工文档脚手架和架构边界，不直接实现业务代码。

本阶段目标：

```text
Phase 0: 文档与目录边界
Phase 1: setup 启动协议
Phase 2: messagebus 事件协议
Phase 3: electron 可视化外壳
Phase 4: agentruntime 线程池与心跳
Phase 5: claudecode PID Agent 生命周期
Phase 6: workplace 隔间与角色文件
Phase 7: 多角色协作编排
Phase 8: output 产物汇总与 Electron 预览
```

本次施工文档优先完成：

```text
1. 建立 dos/carvis 文档脚手架
2. 写清楚总需求、分层边界、施工计划、进度日志
3. 固定 setup / electron / messagebus / agentruntime 的职责
4. 固定总管、文书、美术、调研、技术 Agent 的启动顺序
5. 固定 PID Agent 不立即关闭、全部任务结束后统一关闭的生命周期规则
6. 固定心跳、线程池和进程监督归属 agentruntime
7. 固定主体代码使用 TypeScript
8. 固定 Claude Code CLI 按 DeepSeek 官方 Anthropic 兼容方式适配
```

---

## 2. 非目标

当前阶段禁止实现以下内容：

```text
不直接写 Electron 业务 UI
不直接写 Claude Code CLI 调用代码
不直接写 launchd plist（留到部署阶段）
不引入数据库
不引入远端队列
不写复杂权限系统
不写最终产品生成逻辑
不自动提交或 push
```

第一步只把施工文档迁移成适合 `carvis` 的版本。

---

## 3. 核心运行流

```text
macOS boot
  -> src/setup 启动脚本
  -> 拉起 messagebus
  -> 拉起 agentruntime
  -> 拉起 electron
  -> Electron 显示多个 workplace
  -> 用户在输入框回车提交命令
  -> Electron 将命令发到 messagebus
  -> messagebus 转发给 agentruntime
  -> agentruntime 启动总管 PID Agent
  -> 总管拆解任务
  -> 文书 / 美术 / 调研 PID Agent 并行工作
  -> 各自写入 workplaces
  -> 技术 PID Agent 汇总读取各 workplace
  -> 技术 PID Agent 生成 output
  -> Electron 预览和打开 output 产物
  -> 全部任务结束后 agentruntime 统一关闭 PID Agent
```

---

## 4. 分层总览

```text
00 setup
01 electron
02 messagebus
03 agentruntime
04 claudecode
05 mcp
06 workplaces
07 output
```

严格原则：

- `setup` 只负责启动、重启、退出，不理解 Agent 业务。
- `electron` 只负责显示、输入、预览，不直接管理 PID。
- `messagebus` 只负责消息传递、事件订阅、状态广播，不执行任务。
- `agentruntime` 负责线程池、调度、心跳、角色编排和 PID 生命周期。
- `claudecode` 只封装 Claude Code CLI 进程启动、输入、输出、退出。
- `workplaces` 是角色工作隔间，不承担调度逻辑。
- `output` 是最终产物目录，不反向驱动 Agent。

---

## 5. 每次开工读取顺序

新的 Codex 每次开工必须按顺序读取：

1. `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
2. `dos/carvis/docs/DEV_PROGRESS.md`
3. `dos/carvis/docs/LOG.md`
4. 当前任务相关的 `dos/carvis/docs/progress/layers/*.md`
5. 根目录 `对参考施工文档重构的要求 .txt`

如果上述文档冲突，以 `CODEX_MASTER_REQUIREMENTS.md` 为准；如果主文档和用户最新指令冲突，以用户最新指令为准。
