# Carvis Tool Policy

## 当前阶段

当前施工文档阶段不实现真实工具调用。

## 后续原则

- Claude Code CLI 的工具能力由 PID Agent 自身承担。
- MCP 能力统一放在 `src/agentruntime/mcp`。
- Electron 不直接暴露 shell 或文件写入工具。
- messagebus 不执行工具。
- agentruntime 是工具权限、角色权限和工作目录边界的集中检查点。

## 文件权限

角色 Agent 默认只能写自己的 workplace：

```text
manager    -> workplaces/manager
writer     -> workplaces/writer
artist     -> workplaces/artist
researcher -> workplaces/researcher
engineer   -> workplaces/engineer + output
```

技术 Agent 可读前置角色 workplace，但最终写入只能进入 `output/`。

## 密钥规则

- 不把真实 API Key 写入仓库。
- 不在文档日志中复制真实环境变量值。
- 只记录变量名和加载方式。
