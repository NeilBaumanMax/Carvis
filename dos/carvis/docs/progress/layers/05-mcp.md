# 05 MCP Progress

## 2026-07-03 / Artist image MCP / 当前状态

### 当前事实

- 当前 MCP 重点是本地 artist-image wrapper，不直接暴露给 Electron。
- artist 角色在 Qwen text 输出后，可通过 `callArtistImageMcp()` 规划并生成 `assets/artist-*.png`。
- 本轮未改运行时代码；已有未提交改动增强了图片资产长宽比和透明背景规则，后续提交时一并保留。

### 当前验证

- 远端 README/readback 显示 Qwen Image route 已用于生成本地 image assets。
- 本轮收尾将执行 `npm run typecheck` 和 `npm run build`。

## 2026-07-01 / Phase 0 / 初始化

### 当前目标

预留 MCP 工具桥接边界。

### 本次完成

- 明确 `src/agentruntime/mcp` 只做工具桥接预留
- 明确当前阶段不实现复杂 MCP server
- 明确 MCP 不绕过 agentruntime 暴露给 Electron

### 当前状态

- 已完成：文档边界
- 进行中：无
- 未完成：工具声明、权限说明、可用状态模型

### 下一步

- 补 `src/agentruntime/mcp/README.md`
