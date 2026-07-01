# Carvis MessageBus

`src/messagebus` owns the local event protocol between Electron and `agentruntime`.

## Responsibilities

- Accept `command.submitted` events from Electron.
- Deliver command events to `agentruntime`.
- Broadcast runtime events such as `runtime.heartbeat`, `agent.output`, and `output.ready`.
- Ensure every cross-process event uses a Carvis envelope with `eventId`, `type`, `timestamp`, `source`, optional `target`, `requestId`, `runId`, `agentId`, and `payload`.

## Boundaries

- MessageBus does not execute tasks.
- MessageBus does not read or write workplaces.
- MessageBus does not start or stop Claude Code PID agents.
- MessageBus does not decide role order or task semantics.

## Current Phase

Phase 2 uses an in-memory bus for protocol smoke tests. A later phase can replace the transport with IPC or WebSocket while keeping the envelope contract stable.
