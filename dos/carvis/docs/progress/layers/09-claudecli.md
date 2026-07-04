# 09-claudecli — Claude Code CLI 真实执行接入

## 概述

Phase 9 将 scheduler 的 Agent 执行从纯 mock（setTimeout 模拟）升级为双模式：保留 mock 作为默认 / 降级方案，新增 claude 模式通过真实 Claude Code CLI 子进程执行任务。

## 架构变更

### RuntimeConfig 扩增

```ts
export type ExecutionMode = "mock" | "claude";

export interface RuntimeConfig {
  // ... existing fields
  executionMode: ExecutionMode;   // 新增，默认 "mock"
  claudeTimeoutMs: number;        // 新增，默认 120_000
}
```

### 调度器双模式

| 方法 | mock | claude |
|---|---|---|
| `executeSequential(role)` | setTimeout 模拟，直接写 result.md | AgentManager.startAgent → spawnClaudeCode → write input.md → waitForExit → write result.md |
| `executeParallel(roles)` | 批量 setTimeout | Promise.all 并行启动多个 ClaudeCodeAgent |

### 自动降级

scheduler 初始化时检测 `isClaudeCodeAvailable()`（检查 ANTHROPIC_AUTH_TOKEN 环境变量）。若不可用，`executionMode="claude"` 自动 fallback 到 `"mock"`，打印 `[scheduler] execution mode: mock (fallback, claude CLI not available)`。

## Claude 模式数据流

```
scheduler.advance()
  → executeSequentialClaude("manager")
    → wm.writeFile("manager", "input.md", fullPrompt)
    → agentMgr.startAgent("manager", agentId, runId, [fullPrompt])
      → spawnClaudeCode(["-p", "--session-id", runId, ...], stdin=fullPrompt)
    → claudeAgent.waitForExit()
      → exitResult: { code, signal, error }
    → wm.writeFile("manager", "result.md", summary)
    → publishAgentOutput("manager exited with code N")
```

## Claude E2E Smoke

`src/e2e/claude-smoke.ts` — 与 mock E2E smoke 类似的 6 项断言链路，但设置 `executionMode: "claude"`。无 CLI 时以 `exit(0)` 优雅跳过。

## 文件结构

```
src/agentruntime/
├── types.ts          # ExecutionMode / claudeTimeoutMs
├── scheduler.ts      # executeSequentialClaude / executeParallelClaude
├── index.ts          # 导出 isClaudeCodeAvailable

src/e2e/
├── claude-smoke.ts   # Claude 模式 E2E 测试
```

## npm 脚本

- `npm run e2e:claude-smoke` — 运行 Claude 模式 E2E（无 CLI 时跳过）
