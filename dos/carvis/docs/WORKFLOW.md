# Carvis Construction Workflow

## 核心规则

每次开工先写计划。每次结束先写日志。

这条规则优先级高于普通开发习惯。只要进入真实施工，不允许先写代码再补计划，也不允许结束时只口头说明不写日志。

## 标准施工闭环

每次开机施工必须严格按这个顺序执行：

```text
1. 读取施工文档
2. 写本轮施工计划
3. push GitHub 开发前备份
4. 开始施工
5. 记录施工情况
6. 执行测试并写测试日志
7. 测试不通过则返工并重新测试
8. 测试通过后修正文档漂移
9. 写下次接力文档
10. 上传 GitHub
11. 最后向用户汇报
```

任何步骤失败，都必须停在该步骤记录原因，不能跳到后续步骤假装完成。

## 开工顺序

每次开工必须按顺序执行：

1. 读取主文档、进度、日志、GitHub 回滚规则、测试指标。
2. 检查当前工作区和 GitHub 备份状态。
3. 在 `docs/DEV_PROGRESS.md` 追加或更新本轮“计划”。
4. 在对应 `docs/progress/layers/*.md` 追加本层“计划”。
5. 明确本轮目标、涉及文件、测试指标、回滚点。
6. 创建并 push GitHub 开发前备份分支。
7. 备份成功后，再开始真实代码或文档修改。

如果 GitHub 备份失败：

- 不允许继续真实代码施工。
- 必须在 `docs/LOG.md` 写明失败原因。
- 除非用户明确要求“无备份继续”，否则停止。

## 开工计划模板

写入 `docs/DEV_PROGRESS.md`：

```text
## <date> / <phase> / 开工计划

### 本轮目标

- <goal>

### 涉及层

- <layer>

### 计划修改

- <file or directory>

### 测试计划

- <command>

### GitHub 备份计划

- 当前分支：<branch>
- 基线提交：<commit>
- 备份分支：<backup branch>
- 远端状态：已 push / 未 push，原因

### 回滚预案

- <rollback command or file-level rollback>
```

写入对应层进度日志：

```text
## <date> / <phase> / 开工计划

### 当前目标

- <goal>

### 计划改动

- <change>

### 验收指标

- <metric>
```

## 收尾顺序

每次结束必须按顺序执行：

1. 停止或确认无需停止本轮启动的长跑进程。
2. 先在 `docs/LOG.md` 记录施工情况。
3. 执行本轮测试指标。
4. 将测试结果写入 `docs/LOG.md` 的测试日志。
5. 如果测试失败，返回施工步骤修复，再重新测试，并追加失败和复测记录。
6. 测试通过后，检查并修正文档漂移。
7. 更新 `docs/DEV_PROGRESS.md`。
8. 更新对应 `docs/progress/layers/*.md`。
9. 更新 `docs/HANDOFF.md`，写清楚下次要干什么。
10. 提交并 push 到 GitHub。
11. 在 `docs/LOG.md` 记录最终提交号和 push 状态。
12. 最后再给用户总结。

文档漂移包括：

- 实际架构和 `ARCHITECTURE.md` 不一致。
- 实际 Phase 和 `CONSTRUCTION_PLAN.md` 不一致。
- 实际测试脚本和 `TEST_METRICS.md` 不一致。
- 实际回滚方式和 `GITHUB_ROLLBACK.md` 不一致。
- 实际目录边界和 `CODEX_MASTER_REQUIREMENTS.md` 不一致。

## 收尾日志模板

写入 `docs/LOG.md`：

```text
## <date> / <phase> / <title>

### 本轮计划回放

- <planned goal>

### 本次修改

- <actual change>

### 修改文件

- <file>

### 验证结果

- `<command>`：通过 / 失败 / 未运行，原因

### 测试日志

- 第 1 次测试：<command>，通过 / 失败，摘要
- 失败修复：<change>
- 第 2 次测试：<command>，通过 / 失败，摘要

### 测试指标判断

- 本轮涉及层：<layers>
- 应执行测试：<commands>
- 实际执行测试：<commands>
- 未执行项及原因：<reason>

### GitHub 状态

- 当前分支：<branch>
- 基线提交：<commit>
- 备份分支：<backup branch>
- 本轮提交：<commit>
- push 状态：已 push / 未 push，原因

### 回滚判断

- 是否需要回滚：是 / 否
- 回滚命令：<command>
- 回滚后复测：<command>

### 下一步

- <next>
```

## 测试失败处理

测试失败时必须：

1. 停止继续扩展功能。
2. 在 `docs/LOG.md` 记录失败命令和失败摘要。
3. 修复失败原因。
4. 重新执行失败测试。
5. 必要时重新执行全量测试。
6. 直到测试通过，或明确阻塞并停止。

禁止：

- 禁止测试失败后直接上传 GitHub。
- 禁止只记录最后一次通过，不记录中间失败。
- 禁止把未复测的修复写成已验证。

## GitHub 上传顺序

每轮结束上传 GitHub 前必须确认：

- 测试已经通过。
- 文档漂移已经修正。
- `docs/HANDOFF.md` 已更新。
- `docs/LOG.md` 已记录测试日志和回滚判断。
- `docs/DEV_PROGRESS.md` 已更新。
- 涉及层进度日志已更新。

上传后必须回写：

```text
最终提交号：<commit>
推送分支：<branch>
push 状态：已 push
```

## 禁止事项

- 禁止未写计划就开始真实施工。
- 禁止结束时不写 `docs/LOG.md`。
- 禁止只改总进度，不改涉及层进度。
- 禁止测试失败后把本轮写成完成。
- 禁止没有 push 却写成“远端已备份”。
- 禁止测试失败后上传 GitHub。
- 禁止测试通过后不修正文档漂移。
- 禁止不写接力文档就结束。
