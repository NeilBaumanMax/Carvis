# Carvis AgentRuntime Layer

`src/agentruntime` owns multi-agent orchestration.

Current scope is the real provider runtime used on NixOS. It can still run deterministic smokes, but production mode launches retained provider workers and routes roles to DeepSeek Claude Code CLI or Qwen OpenAI-compatible APIs according to `provider/roles.ts`.

The active run sequence is:

```text
created -> parallel_roles_working -> engineer_building -> output_ready -> retaining_agents
```

`manager_planning` and `manager_reviewing` remain in shared types and helper code for compatibility with older run records and smokes, but the current production flow does not enter a second manager review gate.

## Responsibilities

- Subscribe to `command.submitted` from messagebus.
- Create run state and a task queue.
- Prewarm retained provider workers. `writer` and `engineer` share one worker key so engineer can resume the writer Claude Code session only within the same non-fast/simple run; UI lifecycle events remain separate, and new runs/fast tasks are isolated from previous Claude sessions.
- Run `manager`, `writer`, `artist`, and `researcher` in parallel; then run `engineer`. Manager runs once as a scope/monitor role and writes handoff material for engineer; it is not a repeating letter loop.
- Apply per-command speed mode from Electron/NAS: `fast`, `auto`, or `full`.
- Retain provider PID agents after each role finishes.
- Publish heartbeat and lifecycle events through messagebus.
- Shutdown all retained PID Agents at the end of a run.
- Write each role's public `result.md`, layered handoff files, and provider `usage.json` when metadata is available.

## Boundaries

- AgentRuntime does not render UI.
- AgentRuntime does not bypass messagebus.
- AgentRuntime does not make browser-window decisions; Electron opens the produced output.
- AgentRuntime does not treat manager as a second review gate; engineer owns audit, merge, and production.
- AgentRuntime does not assume Qwen can browse by itself. Researcher web search is only valid when explicit Qwen search options or injected search results are present.

## Speed Modes

`CARVIS_SPEED_MODE` sets the default mode, and the UI can override it per submitted command.

- `fast`: one provider attempt, short quality gate, no default artist image generation.
- `auto`: simple one-line or verification tasks use the fast gate; visual/game/HTML tasks keep fuller behavior.
- `full`: full role output and image workflow.

The UI still shows all five roles and the same envelope/progress sequence. Speed mode changes provider prompts, retry counts, quality thresholds, and image trigger policy.

## Current smoke coverage

`npm run agentruntime:smoke` verifies:

- Electron-style `command.submitted` starts one run;
- manager, writer, artist, and researcher start in the parallel phase;
- manager runs once as a monitor/scope role, not as a second review gate;
- engineer starts after the parallel roles and performs audit, conflict merge, and production together;
- `pidagent:smoke` verifies that `writer` and `engineer` can share a retained provider worker PID;
- heartbeat contains PID pool counts and queue depth;
- all retained PID Agents are shutdown at final cleanup.

## Runtime Artifacts

Each run writes role workspaces under `workplaces/runs/<timestamp-request>/`:

- `result.md`: public role output.
- `handoff_to_engineer.json`: compressed facts, decisions, assets, constraints, and risks.
- `evidence_index.json`: pointers to the source of important facts.
- `usage.json`: provider/model/role plus token usage. Qwen returns real `prompt_tokens`, `completion_tokens`, and `total_tokens`; DeepSeek through Claude Code CLI currently records `estimated_*_tokens` because the CLI does not expose provider usage in this route.

Final output is written under `output/runs/<timestamp-request>/`, including `game-preview.html`, `final-report.md`, `manifest.json`, and copied/generated `assets/`.
