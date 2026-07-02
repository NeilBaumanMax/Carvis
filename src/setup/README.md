# Setup Layer

`src/setup` is the local startup boundary for Carvis.

## Responsibilities

- Load local startup configuration.
- Start core processes in this order:
  1. `messagebus`
  2. `agentruntime`
  3. `electron`
- Stop startup when a required component fails.
- Emit a simple event trail for smoke tests and logs.
- Provide smoke coverage for the NixOS systemd user-service setup.

## Boundaries

- Setup does not split user tasks.
- Setup does not directly start role provider workers; `agentruntime` owns provider worker prewarming and retention.
- Setup does not call Claude Code CLI or Qwen APIs.
- Setup does not read or write role workplace files.

## Modes

- `plan`: simulate startup order without spawning child processes.
- `spawn`: spawn configured commands.

Environment:

```text
CARVIS_SETUP_MODE=plan | spawn
CARVIS_SETUP_TIMEOUT_MS=15000
```
