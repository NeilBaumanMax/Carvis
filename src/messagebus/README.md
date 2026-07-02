# Carvis MessageBus

`src/messagebus` owns the local event protocol between Electron and `agentruntime`.

## Responsibilities

- Accept `command.submitted` events from Electron.
- Deliver command events to `agentruntime`.
- Broadcast runtime events such as `runtime.heartbeat`, `agent.output`, `run.phase.changed`, and `output.ready`.
- Ensure every cross-process event uses a Carvis envelope with `eventId`, `type`, `timestamp`, `source`, optional `target`, `requestId`, `runId`, `agentId`, and `payload`.
- Provide the remote bus used by the NixOS systemd user services.

## Boundaries

- MessageBus does not execute tasks.
- MessageBus does not read or write workplaces.
- MessageBus does not start or stop Claude Code or Qwen provider workers.
- MessageBus does not decide role order or task semantics.

## Current state

The project has both in-memory smoke coverage and the remote messagebus used by `carvis-messagebus.service`.
