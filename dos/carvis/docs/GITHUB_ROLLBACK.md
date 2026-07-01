# GitHub Backup And Rollback Policy

## 目标

每轮真实代码开发前，必须先形成一个可定位、可回退、可推送到 GitHub 的备份点。每轮开发完成后，必须说明是否需要回滚，并给出明确回滚命令和复测命令。

## 开工前 GitHub 备份要求

真实代码开发前必须完成：

1. 检查当前分支：

```text
git branch --show-current
```

2. 检查工作区：

```text
git status --short
```

3. 如果存在用户未提交改动，必须记录，不得覆盖或回滚。

4. 获取当前基线提交：

```text
git rev-parse HEAD
```

5. 创建备份分支：

```text
git switch -c backup/pre-<phase>-<yyyymmdd-hhmm>
git push -u origin backup/pre-<phase>-<yyyymmdd-hhmm>
```

6. 回到开发分支：

```text
git switch <working-branch>
```

7. 在 `docs/LOG.md` 写入：

```text
开发前基线提交：<commit>
开发前备份分支：backup/pre-<phase>-<yyyymmdd-hhmm>
远端备份状态：已 push / 未 push，原因
```

如果项目还没有初始化 Git 或没有 GitHub remote，不允许把本轮描述为“具备 GitHub 回滚点”。必须在日志中写明：

```text
Git 状态：未初始化 / 无 remote
回滚能力：只能本地删除新增文件或手动恢复
阻塞项：需要先初始化仓库并设置 GitHub remote
```

## 开发中保护规则

- 不允许 `git reset --hard`。
- 不允许 `git checkout -- <file>` 回滚用户改动。
- 不允许覆盖未确认来源的修改。
- 如果发现工作区有新变化，先判断是否属于本轮修改。
- 如果不是本轮修改，只记录并绕开。

## 收尾上传要求

真实代码开发完成后必须：

1. 先在 `docs/LOG.md` 记录施工情况。
2. 运行本阶段要求的测试。
3. 测试失败时返工并重新测试，不允许上传。
4. 测试通过后修正文档漂移。
5. 更新 `docs/DEV_PROGRESS.md`。
6. 更新涉及层的 `docs/progress/layers/*.md`。
7. 更新 `docs/HANDOFF.md`。
8. 写清楚变更摘要、测试结果、风险、回滚判断。
9. 提交并 push 到当前开发分支。

日志必须记录：

```text
提交号：<commit>
推送分支：<branch>
推送状态：已 push / 未 push，原因
```

如果没有 push，不允许把本轮标记为完整完成。

测试未通过时，不允许 push 当前开发分支，除非用户明确要求保存失败现场；这种情况必须使用 `wip/failing-<phase>-<yyyymmdd-hhmm>` 分支，并在日志中标记“失败现场，不是可用版本”。

## 回滚触发条件

出现以下情况必须评估回滚：

- `npm run typecheck` 失败且短时间不能修复
- 单元测试失败且影响已存在能力
- smoke test 失败且阻塞主流程
- Electron 无法启动
- messagebus 无法收发基本事件
- agentruntime 无法正常 shutdown
- Claude Code PID 泄漏或无法统一关闭
- output 产物生成位置错误
- 引入真实 API Key 或敏感文件
- 修改越过当前 Phase 边界

## 回滚命令模板

优先回滚本轮提交，不破坏用户未提交改动：

```text
git revert <bad-commit>
```

如果本轮有多个提交：

```text
git revert <oldest-bad-commit>^..<newest-bad-commit>
```

禁止默认使用：

```text
git reset --hard
```

除非用户明确要求，并且已经确认没有需要保留的未提交改动。

## 回滚后复测要求

回滚后必须运行与失败点相关的最小复测：

```text
npm run typecheck
npm test
```

如果涉及 Electron：

```text
npm run electron:smoke
```

如果涉及 messagebus：

```text
npm run messagebus:smoke
```

如果涉及 agentruntime：

```text
npm run agentruntime:smoke
```

实际项目脚本尚未建立时，必须在日志中写：

```text
复测命令尚未存在，原因：当前 Phase 未建立对应脚本
替代验证：<实际执行的命令>
```
