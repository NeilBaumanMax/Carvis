# Carvis Electron Layer

`src/electron` owns the local visual shell contract for Carvis.

Current Phase 3 scope includes a TypeScript shell state model and a static HTML renderer snapshot. The renderer is ready to be mounted by a future Electron `BrowserWindow`, while smoke tests remain browser-free for NixOS/headless verification.

## Responsibilities

- Show five workplace panels: `manager`, `writer`, `artist`, `researcher`, `engineer`.
- Keep display state for agent status, PID, heartbeat time, and latest output summary.
- Submit user commands through messagebus as `command.submitted`.
- Subscribe to runtime status events through messagebus.
- Show output entries after `output.ready`.
- Render the current shell state into an HTML workbench snapshot.

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

`npm run electron:ui-smoke` verifies:

- the rendered HTML contains all five role panels;
- the command input and submit button are present;
- output links and recent events are visible;
- responsive CSS rules for narrow screens are present.
