# Layer 07: Output 汇总与预览

## 概述

Output 模块负责聚合所有角色 workplace 产物，生成最终交付物并广播 `output.ready` 事件供 Electron 预览。

## 产出物

| 文件 | 格式 | 说明 |
|------|------|------|
| `output/manifest.json` | JSON | 元信息清单（runId / createdAt / 各角色 result 长度+log 行数 / files） |
| `output/report.md` | Markdown | 最终报告，按角色顺序汇总全部 result.md |

## OutputManifest 结构

```json
{
  "runId": "run-abc12345",
  "createdAt": "2026-07-04T08:48:00.000Z",
  "roles": {
    "manager": { "resultLength": 42, "logLines": 3 },
    "writer": { "resultLength": 28, "logLines": 2 },
    "artist": { "resultLength": 30, "logLines": 2 },
    "researcher": { "resultLength": 35, "logLines": 4 },
    "engineer": { "resultLength": 48, "logLines": 5 }
  },
  "files": ["manifest.json", "report.md"]
}
```

## API

### `createOutputManager(rootPath: string): OutputManager`

### OutputManager 方法

| 方法 | 说明 |
|------|------|
| `generateOutput(runId, wm)` | 聚合 WorkplaceManager 中 5 角色 result.md → 写 manifest.json + report.md |
| `readOutput()` | 反序列化 output/manifest.json |

## 事件流

```
scheduler (output_ready phase)
  │
  ├── wm.initAll()           ← 确保 workplace 目录就绪
  ├── om.generateOutput()    ← 写 manifest.json + report.md
  ├── busClient.publishOutputReady(outputPath, manifestPath, runId)
  │     │
  │     └── messagebus → Electron（待实现订阅）
  │
  └── phase → retaining_agents
```

## 集成点

- scheduler 在 `output_ready` 阶段调用 OutputManager。
- `publishOutputReady` 广播 `output.ready` 事件，携带 `OutputReadyPayload(outputPath, manifestPath)`。
- Electron 端需订阅 `output.ready` 事件以渲染报告预览（Phase 8）。

## 测试

```bash
npm run output:smoke
```

覆盖项：
1. generateOutput 成功写入 2 文件
2. manifest.json 为合法 JSON 且结构完整
3. report.md 含全部 5 角色章节
4. output 目录精确 2 文件
5. readOutput 往返一致性
