# Carvis AgentRuntime Layer

`src/agentruntime` owns multi-agent orchestration.

Current Phase 4 scope is a deterministic runtime core with a simulated PID pool. It does not launch Claude Code yet; Phase 5 will connect the `claudecode` process wrapper.

## Responsibilities

- Subscribe to `command.submitted` from messagebus.
- Create run state and a task queue.
- Run roles in the fixed order: `manager` planning first, `writer` / `artist` / `researcher` in parallel, `manager` review gate, then `engineer`.
- Retain simulated PID Agents after each role finishes.
- Publish heartbeat and lifecycle events through messagebus.
- Shutdown all retained PID Agents at the end of a run.

## Boundaries

- AgentRuntime does not render UI.
- AgentRuntime does not bypass messagebus.
- AgentRuntime does not write final files directly in Phase 4.
- AgentRuntime does not call Claude Code CLI in Phase 4.

## Current smoke coverage

`npm run agentruntime:smoke` verifies:

- Electron-style `command.submitted` starts one run;
- manager starts before the parallel roles;
- manager runs a second review gate after writer, artist, and researcher are done;
- engineer starts only after the manager review gate is done;
- heartbeat contains PID pool counts and queue depth;
- all retained PID Agents are shutdown at final cleanup.
