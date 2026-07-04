# Layer 06: Workplaces 角色隔间

## 概述

Workplace 模块为 Carvis 的 5 个固定角色（manager/writer/artist/researcher/engineer）提供物理文件系统级别的隔间管理。每个角色拥有独立目录，内置 4 个标准文件，且写入操作受角色隔离校验保护。

## 目录结构

```
workplaces/
├── manager/
│   ├── input.md     ← 总管接收的任务描述
│   ├── plan.md      ← 总管制定的执行计划
│   ├── log.md       ← 总管执行日志
│   └── result.md    ← 总管产出
├── writer/
│   ├── input.md
│   ├── plan.md
│   ├── log.md
│   └── result.md
├── artist/
│   ├── input.md
│   ├── plan.md
│   ├── log.md
│   └── result.md
├── researcher/
│   ├── input.md
│   ├── plan.md
│   ├── log.md
│   └── result.md
└── engineer/
    ├── input.md     ← 工程师汇总前置角色结果
    ├── plan.md
    ├── log.md
    └── result.md
```

## 前置角色映射

| 角色 | 前置角色（可读） |
|------|-------------------|
| manager | (无) |
| writer | manager |
| artist | manager |
| researcher | manager |
| engineer | manager, writer, artist, researcher |

基于 `ROLE_FLOW`（`src/agentruntime/types.ts`）自动推算。

## API

### `createWorkplaceManager(rootPath: string): WorkplaceManager`

创建 workplace 管理器实例。

### WorkplaceManager 方法

| 方法 | 说明 |
|------|------|
| `initAll()` | 创建所有 5 个角色目录及默认文件 |
| `initRole(role)` | 创建单个角色 workplace |
| `getPath(role)` | 获取角色 workplace 绝对路径 |
| `writeFile(role, file, content)` | 写入 workplace 文件（带隔离校验） |
| `appendFile(role, file, content)` | 追加 workplace 文件（带隔离校验） |
| `readFile(role, file)` | 读取 workplace 文件 |
| `fileExists(role, file)` | 检查文件是否存在 |
| `getPriorRoles(role)` | 获取前置角色列表 |
| `collectPriorResults(role)` | 聚合所有前置角色 result.md |
| `verifyPath(role, path)` | 校验路径是否在当前角色 workplace 内 |

## 隔离规则

- `writeFile()` / `appendFile()` 自动校验写入路径必须位于角色 workplace 目录内。
- 越权写入会抛出 `Error`。
- 读取操作不限制角色（engineer 可读所有前置角色）。
- 外部调用 `verifyPath()` 可在写入前做额外校验。

## 集成点

- `AgentPool.createAgent()` 已设置 `workplacePath = config.workplaceRoot/role`。
- scheduler 应在执行流程前调用 `wm.initAll()`。
- Claude Code Agent 读写 workplace 文件时应通过 WorkplaceManager 而非直接 `fs`。

## 测试

```bash
npm run workplaces:smoke
```

覆盖项：
1. initAll 创建 20 个文件
2. 写入/读取正确性
3. 角色隔离（cross-role verifyPath 返回 false）
4. 前置角色计算
5. collectPriorResults 聚合
6. log 追加
