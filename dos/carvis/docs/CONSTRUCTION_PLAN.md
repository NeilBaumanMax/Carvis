# Carvis Construction Plan

## 当前目标

在根目录现有 `src` 层次基础上迁移一套新的施工文档，指导后续实现 NixOS 多进程多 Agent 可视化系统。

## Phase 0: 文档与边界

目标：

- 建立 `dos/carvis` 施工文档脚手架
- 固定主需求、架构、施工计划、日志、分层进度
- 固定现有 `src` 目录职责

验收标准：

- `dos/carvis/CODEX_START_HERE.md` 存在
- `dos/carvis/CODEX_MASTER_REQUIREMENTS.md` 存在
- `dos/carvis/docs/*` 核心文档存在
- `dos/carvis/docs/GITHUB_ROLLBACK.md` 存在
- `dos/carvis/docs/TEST_METRICS.md` 存在
- `docs/progress/layers` 有 setup/electron/messagebus/agentruntime 等层日志

## Phase 1: setup 启动协议

目标：

- 明确 NixOS 自启动入口
- 明确 messagebus / agentruntime / electron 启动顺序
- 明确环境变量加载和退出策略

验收标准：

- 存在 `src/setup/README.md`
- 存在启动配置类型
- 可以用本地命令模拟启动顺序
- TypeScript `typecheck` 通过
- 开发前存在 GitHub 备份分支或日志明确说明无 remote
- setup smoke test 通过或日志明确说明脚本未建立

## Phase 2: messagebus 事件协议

目标：

- 建立本地 IPC 或 WebSocket 事件协议
- 定义 command、run、agent、heartbeat、output 事件
- 建立 requestId / runId / agentId 贯穿字段

验收标准：

- Electron 可发送命令事件
- agentruntime 可订阅命令事件
- agentruntime 可广播 heartbeat
- messagebus smoke test 通过
- 事件 envelope 字段完整

## Phase 3: Electron 可视化外壳

目标：

- 显示多个 workplace 面板
- 显示 Agent 状态、PID、心跳、日志摘要
- 提供输入框，回车提交命令
- 预览和打开 output

验收标准：

- 可看到 manager/writer/artist/researcher/engineer 五个隔间
- 输入命令后有 messagebus 事件
- output.ready 后能显示产物入口
- 桌面与窄窗口下 UI 无重叠、无文字溢出
- electron smoke test 通过

## Phase 4: agentruntime 调度核心

目标：

- 建立任务队列
- 建立 PID Agent 池
- 建立心跳计时器
- 建立监督日志
- 固定角色编排状态机

验收标准：

- 总管先运行
- 文书 / 美术 / 调研可并行
- 技术 Agent 等待前置角色结束后运行
- 所有 PID 在最终阶段统一关闭
- shutdown 后无残留 PID
- agentruntime smoke test 通过

## Phase 5: Claude Code CLI PID 封装

目标：

- 封装 Claude Code CLI 命令
- 注入角色 prompt 和 skills
- 按 DeepSeek 官方 Claude Code 接入文档注入 Anthropic 兼容环境变量
- 捕获 stdout/stderr/exit
- 支持保活和统一关闭

验收标准：

- 可启动一个测试 PID Agent
- 可写入一条角色输入
- 可捕获输出并转成 messagebus 事件
- 不把真实 `ANTHROPIC_AUTH_TOKEN` 写进仓库
- 缺少 token 时有明确配置错误
- claudecode smoke test 通过

## Phase 6: workplaces 隔间

目标：

- 为每个角色建立独立 workplace
- 固定输入、过程、输出文件命名
- Electron 可按 workplace 展示状态

验收标准：

- 每个角色目录独立
- agentruntime 不混写角色文件
- 技术 Agent 能读取所有前置 workplace
- workplaces smoke test 通过

## Phase 7: output 汇总与预览

目标：

- 技术 Agent 汇总生成最终产物
- 产物写入 `output/`
- Electron 预览和打开产物

验收标准：

- `output/` 下出现最终文件
- messagebus 广播 `output.ready`
- Electron 可打开产物
- output smoke test 通过
- output manifest 可被 Electron 读取

## Phase 8: 验收与回滚

目标：

- 建立 smoke test
- 建立日志追踪
- 建立失败分类
- 建立回滚说明

验收标准：

- setup smoke test 通过
- messagebus smoke test 通过
- agentruntime role flow smoke test 通过
- claudecode smoke test 通过
- electron smoke test 通过
- e2e smoke test 通过
- GitHub 备份点、提交号、push 状态已记录
- 回滚命令和回滚后复测命令已记录
- 文档日志已更新
