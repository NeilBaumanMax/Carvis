# Carvis Electron Layer

`src/electron` owns the local visual shell for Carvis.

## Responsibilities

- Show five role panels: `manager`, `writer`, `artist`, `researcher`, `engineer`.
- Keep display state for agent status, PID, heartbeat time, and latest output summary.
- Submit user commands through messagebus as `command.submitted`.
- Subscribe to runtime status events through messagebus.
- Show output entries after `output.ready`.
- Open the current run's `game-preview.html` in a browser/preview path without relying on stale output folders.
- Keep the app usable in the NixOS 1280x720 desktop, including the 1000x640 shell window.

## Boundaries

- Electron does not start, stop, or retain provider PID workers.
- Electron does not call Claude Code CLI or Qwen APIs.
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

`npm run electron:browser-smoke` verifies the BrowserWindow adapter without requiring the Electron runtime.

`npm run electron:visual-smoke` requires an Electron runtime on PATH. On NixOS it can run with:

```text
nix --extra-experimental-features "nix-command flakes" shell nixpkgs#electron --command npm run electron:visual-smoke
```
