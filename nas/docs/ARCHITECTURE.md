# NAS Architecture

当前结构：

```text
carvis/
├─ src/          # Electron/messagebus/agentruntime
└─ nas/          # NAS remote control system
   ├─ apps/client
   ├─ apps/server
   ├─ packages/shared
   ├─ packages/protocol
   ├─ infra
   ├─ data
   ├─ config
   └─ docs
```

核心原则：真实 output 和历史产物不复制到 `nas/` 或项目根目录。`nas/config/paths.yaml` 只记录真实路径，Go server 使用白名单根目录解析相对路径，拒绝越界访问。

数据流：

```text
phone web input
  -> NAS Go server /api/input
  -> Electron HTTP API /api/input
  -> Electron renderer remoteDraft
  -> 输入框同步 + 画面浮字

phone web submit
  -> NAS Go server /api/submit
  -> Electron HTTP API /api/submit
  -> messagebus command.submitted
  -> agentruntime
  -> output/runs/<run>
```
