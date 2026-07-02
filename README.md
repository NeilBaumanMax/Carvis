# carvis

Carvis is a local multi-agent Electron workflow for generating a playable output from five long-lived role workers.

## Current Runtime Shape

- `manager`: DeepSeek through Claude Code CLI
- `writer`: DeepSeek through Claude Code CLI
- `artist`: Qwen OpenAI-compatible route by default
- `researcher`: Qwen OpenAI-compatible route by default
- `engineer`: DeepSeek through Claude Code CLI
- `artist` image generation: Qwen Image through the local artist-image MCP wrapper

For NixOS testing while Qwen real auth is unresolved, set:

```bash
CARVIS_PROVIDER_MODE=all-deepseek
```

This keeps the same five-role collaboration flow while routing every role through DeepSeek Claude Code.

## Collaboration Rules

The manager is a monitor/scope role, not a second review gate.

- `manager`, `writer`, `artist`, and `researcher` start in parallel after a command is submitted.
- Manager writes a short task boundary and abnormal-output watch list: empty files, `PROVIDER_ERROR`, fake tool calls, obvious laziness, missing role-critical material, or unrelated output.
- Engineer performs audit, conflict merge, and production together. If the roles disagree on names, dimensions, values, or scope, engineer unifies them and produces the final fenced `html` block.

The runtime supports this with:

- PID worker quality validation and retry (`CARVIS_REAL_PROVIDER_MAX_ATTEMPTS`)
- one prewarmed provider worker per role
- extraction of engineer fenced HTML into `output/game-preview.html`

## NixOS Verified

Remote test path:

```text
~/carvis-remote-smoke
```

Verified on NixOS:

- systemd user services active: `carvis-messagebus`, `carvis-agentruntime`, `carvis-electron`
- real DeepSeek Claude Code route works for manager, writer, and engineer
- Qwen remains active for artist/researcher text and artist image generation
- five-role all-DeepSeek run produced:
  - `workplaces/live/manager/result.md`
  - `workplaces/live/writer/result.md`
  - `workplaces/live/artist/result.md`
  - `workplaces/live/researcher/result.md`
  - `workplaces/live/engineer/result.md`
  - `output/game-preview.html`
- `output/game-preview.html` opens in Firefox as a real Canvas game, not a report preview.

Recent manual verification:

```bash
npm run build
npm run agentruntime:smoke
npm run output:smoke
npm run setup:systemd-smoke
```

## Qwen Status

The Qwen code path exists and dry routing passes, but the currently tested Qwen credential failed real authentication against DashScope-compatible endpoints. See [QWEN_API_ISSUE.md](./QWEN_API_ISSUE.md).

No API keys are committed to this repository.
