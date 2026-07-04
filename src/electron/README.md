# Carvis Electron Layer

`src/electron` owns the local visual shell contract for Carvis.

Current Phase 3+4 scope includes a real Electron window for local macOS startup plus a TypeScript mock shell for protocol smoke tests.

## Responsibilities

- Show five workplace panels: `manager`, `writer`, `artist`, `researcher`, `engineer`.
- Keep display state for agent status, PID, heartbeat time, and latest output summary.
- Submit user commands through messagebus as `command.submitted`.
- Subscribe to runtime status events through messagebus.
- Show output entries after `output.ready`.

## Boundaries

- Electron does not start, stop, or retain PID Agent processes.
- Electron does not call Claude Code CLI.
- Electron does not read or write role workplace files directly.
- Electron does not call agentruntime directly; all interaction goes through messagebus.

## Current smoke coverage

`npm run electron:smoke` verifies:

- the shell creates all five workplace panels;
- command submission publishes `command.submitted` to `agentruntime`;
- `runtime.heartbeat` updates runtime display state;
- `output.ready` creates a visible output entry.

`npm start` launches the real Electron window through `electron:start`. The visible window currently renders the five workplace panels and a local command input demo while the mock shell remains available through `electron:mock`.
