# 06 Workplaces Progress

## 2026-07-02 / Local MVP smoke / 本次完成

### 当前目标

- 建立最小 workplace 文件结构，支撑 e2e smoke 生成真实角色产物。

### 本次完成

- 新增 `src/agentruntime/workplaces/README.md`
- 新增 `src/agentruntime/workplaces/index.ts`
- 新增 `src/agentruntime/workplaces/smoke.ts`
- 新增 `npm run workplaces:smoke`
- 每个角色 workplace 生成 `input.md`、`plan.md`、`log.md`、`result.md`

### 测试基线

- 本地 `npm run workplaces:smoke`：通过
- 远端 NixOS `npm run workplaces:smoke`：通过

### 未完成

- 尚未做权限隔离。
- 尚未把真实 Claude Code Agent 的文件写入限制到对应 workplace。

## 2026-07-01 / Phase 0 / 初始化

### 当前目标

固定各角色 workplace 隔间结构。

### 本次完成

- 明确 manager/writer/artist/researcher/engineer 五类 workplace
- 明确每个角色只写自己的 workplace
- 明确 engineer 可读前置 workplace 并写入 output

### 当前状态

- 已完成：文档边界
- 进行中：无
- 未完成：目录模板、文件命名、状态摘要生成

### 下一步

- 补 `src/agentruntime/workplaces/README.md`
- 定义 input/plan/log/result/artifacts 文件约定

## 2026-07-02 / NixOS MVP 验收 / 补充

### 本次完成

- `mvp:real-smoke` 在 NixOS 临时项目目录下为五角色创建独立 workplace。
- 每个真实 Claude Code 角色输出写入对应 `result.md`。
- engineer/output 汇总阶段读取五角色 workplace 结果。

### 测试基线

- 本地 `npm test`：通过。
- 远端 NixOS `npm test`：通过。
- 远端 NixOS `mvp:real-smoke`：通过。

### 剩余风险

- 当前还没有 OS 级权限隔离。
- 真实 Claude Code CLI 的工具访问范围后续仍需进一步限制到对应 workplace。
