# Setup Layer

`src/setup` is the macOS startup boundary for Carvis.

Responsibilities:

- Load local startup configuration.
- Start core processes in this order:
  1. `messagebus`
  2. `agentruntime`
  3. `electron`
- Stop startup when a required component fails.
- Emit a simple event trail for smoke tests and future logs.

Non-responsibilities:

- Does not split user tasks.
- Does not start role PID agents.
- Does not call Claude Code CLI.
- Does not read or write role workplace files.

The first implementation supports two modes:

- `plan`: simulate startup order without spawning child processes.
- `spawn`: spawn configured commands.

Environment:

```text
CARVIS_SETUP_MODE=plan | spawn
CARVIS_SETUP_TIMEOUT_MS=15000
```
