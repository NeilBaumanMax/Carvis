# Carvis AgentRuntime Layer

`src/agentruntime` owns multi-agent orchestration.

Current scope is the real provider runtime used on NixOS. It can still run deterministic smokes, but production mode launches retained provider workers and routes roles to DeepSeek Claude Code CLI, DeepSeek OpenAI-compatible API, or Qwen OpenAI-compatible APIs according to `provider/roles.ts`.

The active run sequence is:

```text
created -> manager_planning -> parallel_roles_working -> manager_reviewing -> engineer_building -> output_ready -> retaining_agents
```

`manager_planning` writes the initial task contract once. `manager_reviewing` writes one compressed handoff/review after writer, artist, and researcher finish. It is not a repeating letter loop.

## Responsibilities

- Subscribe to `command.submitted` from messagebus.
- Create run state and a task queue.
- Prewarm retained provider workers. `writer` and `engineer` share one worker key so engineer can resume the writer Claude Code session only within the same non-fast/simple run; UI lifecycle events remain separate, and new runs/fast tasks are isolated from previous Claude sessions.
- Run `manager` once, then `writer`, `artist`, and `researcher` in parallel, then `manager` once for the engineer handoff, then `engineer`.
- Apply per-command speed mode from Electron/NAS: `fast`, `auto`, or `full`.
- Retain provider PID agents after each role finishes.
- Publish heartbeat and lifecycle events through messagebus.
- Keep retained provider workers warm after a run so the next command can start quickly; shutdown only happens when the service stops.
- Write each role's public `result.md`, layered handoff files, and provider `usage.json` when metadata is available.

## Boundaries

- AgentRuntime does not render UI.
- AgentRuntime does not bypass messagebus.
- AgentRuntime does not make browser-window decisions; Electron opens the produced output.
- AgentRuntime does not let manager loop or repeatedly write letters; engineer owns final audit, merge, and production after the single manager review/handoff.
- AgentRuntime does not assume model-side browsing is trustworthy. Researcher web search is only valid when Scrapling evidence is injected; otherwise researcher must mark facts as not found or unverified.

## Speed Modes

`CARVIS_SPEED_MODE` sets the default mode, and the UI can override it per submitted command.

- `fast`: one provider attempt, short quality gate, no default artist image generation.
- `auto`: simple one-line or verification tasks use the fast gate; visual/game/HTML tasks keep fuller behavior.
- `full`: full role output and image workflow.

The UI still shows all five roles and the same envelope/progress sequence. Speed mode changes provider prompts, retry counts, quality thresholds, and image trigger policy.

Artist image generation first emits a fixed plan (`PLANNED_IMAGE_ASSETS`) with stable `assets/artist-*.png` paths. Full mode waits for all planned images. Fast mode only triggers images when the command explicitly asks for them, returns after the first critical image, and lets remaining planned filenames resolve when background jobs land.

## Current smoke coverage

`npm run agentruntime:smoke` verifies:

- Electron-style `command.submitted` starts one run;
- manager writes the initial task contract before employee roles;
- writer, artist, and researcher start in the parallel phase;
- manager runs exactly one review/handoff before engineer;
- engineer starts after the parallel roles and performs audit, conflict merge, and production together;
- `pidagent:smoke` verifies that `writer` and `engineer` can share a retained provider worker PID;
- heartbeat contains PID pool counts and queue depth;
- all five visible roles can be retained after the run.

## Runtime Artifacts

Each run writes role workspaces under `workplaces/runs/<timestamp-request>/`:

- `result.md`: public role output.
- `handoff_to_engineer.json`: compressed facts, decisions, assets, constraints, and risks.
- `evidence_index.json`: pointers to the source of important facts.
- `usage.json`: provider/model/role plus token usage. Qwen and DeepSeek API routes return real `prompt_tokens`, `completion_tokens`, and `total_tokens`; DeepSeek through Claude Code CLI currently records `estimated_*_tokens` because the CLI does not expose provider usage in this route.

Final output is written under `output/runs/<timestamp-request>/`, including `game-preview.html`, `final-report.md`, `manifest.json`, and copied/generated `assets/`.
