# AgentRuntime Layer

`src/agentruntime` owns Carvis role orchestration, runtime heartbeat state, and future PID Agent lifecycle management.

Current Phase 4 scope is a minimal local runtime skeleton. It does not start real Claude Code PID Agents yet.

## Responsibilities

- Keep runtime state for manager, writer, artist, researcher, and engineer.
- Publish runtime heartbeat payloads through messagebus-compatible events.
- Preserve the fixed role flow: manager first, writer/artist/researcher in parallel, engineer last.
- Keep PID lifecycle ownership inside agentruntime.

## Boundaries

- AgentRuntime does not render UI.
- AgentRuntime does not bypass messagebus for external communication.
- AgentRuntime does not write role work files into the runtime root.
- AgentRuntime does not hard-code provider API keys.

## Current smoke coverage

`npm run agentruntime:smoke` verifies:

- default agents are created in the fixed role order;
- heartbeat payloads count active, idle, and retained agents;
- a mock role flow reaches retained status for all roles;
- `output.ready` is emitted after the engineer phase.
