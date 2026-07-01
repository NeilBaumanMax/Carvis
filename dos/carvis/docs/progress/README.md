# Carvis Progress System

本目录用于让不同会话、不同 Codex 连续接力开发 `carvis`。

## 读取顺序

1. `dos/carvis/CODEX_MASTER_REQUIREMENTS.md`
2. `dos/carvis/docs/DEV_PROGRESS.md`
3. `dos/carvis/docs/LOG.md`
4. `dos/carvis/docs/GITHUB_ROLLBACK.md`
5. `dos/carvis/docs/TEST_METRICS.md`
6. `dos/carvis/docs/WORKFLOW.md`
7. `dos/carvis/docs/progress/layers/*.md`

## 写入规则

- 总进度写入 `docs/DEV_PROGRESS.md`
- 每轮施工写入 `docs/LOG.md`
- 涉及某一层时，追加对应层日志
- 只追加，不覆盖旧记录
- 真实代码开发前必须记录 GitHub 备份点
- 真实代码开发后必须记录测试指标执行情况
- 没有远端备份或没有测试脚本时，必须写明原因
- 每次开工前必须先写本轮计划
- 每次收尾必须先写 `docs/LOG.md`
- 测试失败必须记录失败、返工、复测全过程
- 测试通过后必须修正文档漂移
- 每次结束必须更新 `docs/HANDOFF.md`
- 每次结束必须上传 GitHub；不能上传时必须写明原因

## 当前分层

```text
00-setup
01-electron
02-messagebus
03-agentruntime
04-claudecode
05-mcp
06-workplaces
07-output
```
