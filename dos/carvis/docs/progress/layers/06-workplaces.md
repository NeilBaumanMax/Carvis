# 06 Workplaces Progress

## 2026-07-02 / Manager review artifact / 本次完成

### 本次完成

- `WorkplacePaths` 新增 `reviewPath`。
- 新增 `writeManagerReview()`，把主管复审写入 `manager/review.md`，并追加到 `manager/result.md`。
- 最终 output 读取 manager result 时会带上复审 gate，engineer 可据此消费通过审核的员工产物。
- `workplaces:smoke` 断言 `manager/review.md` 包含审核结论，且 `manager/result.md` 包含 `Manager Review Gate`。

### 测试基线

- 本地 `npm run workplaces:smoke`：通过。
- 本地 `npm run build`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `manager/review.md` 已验证包含 `Gate 结论：全部通过，交给 engineer 进入制作集成`。

### 剩余风险

- 当前只有 manager 使用 `review.md`；如果未来要多级审核，需要把 review artifact 从 manager 专用扩展成通用 gate 文件。

## 2026-07-02 / Role skill files / 本次完成

### 本次完成

- 每个角色 workplace 新增 `skill.md`，由 `initializeWorkplaces()` 初始化写入。
- `plan.md` 不再是占位文本，改为包含本角色已安装 3 个 skill、协作输入、必须产出和质量门槛。
- `WORKPLACE_FILES` 更新为 `input.md`、`skill.md`、`plan.md`、`log.md`、`result.md`。
- `workplaces:smoke` 增加断言，确保五个角色都安装了 skill 文件且每个角色恰好 3 个 skill。

### 测试基线

- 本地 `npm run workplaces:smoke`：通过。
- 本地 `npm test`：通过。
- 远端 NixOS `npm run workplaces:smoke`：通过。
- 远端 `workplaces/live/*/skill.md` 已验证存在。

### 剩余风险

- 当前仍未做 OS 级权限隔离；skill 文件是协作约束，不是沙箱边界。

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
