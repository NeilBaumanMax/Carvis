# carvis

Carvis is a local multi-agent Electron workflow for generating a playable output from five long-lived role workers.

## Current Runtime Shape

- `manager`: DeepSeek through Claude Code CLI
- `writer`: Qwen OpenAI-compatible route by default
- `artist`: Qwen OpenAI-compatible route by default
- `researcher`: Qwen OpenAI-compatible route by default
- `engineer`: DeepSeek through Claude Code CLI

For NixOS testing while Qwen real auth is unresolved, set:

```bash
CARVIS_PROVIDER_MODE=all-deepseek
```

This keeps the same five-role collaboration flow while routing every role through DeepSeek Claude Code.

## Collaboration Rules

The manager review gate is intentionally not a product-perfection blocker.

- Block only abnormal output: empty files, `PROVIDER_ERROR`, fake tool calls, obvious laziness, missing role-critical material, or unrelated output.
- If the roles disagree on names, dimensions, enemy counts, values, or scope, the manager should write a unified integration standard and pass the task to engineer.
- Engineer consumes the manager review as the highest-priority integration contract and must produce a complete fenced `html` block for playable game tasks.

The runtime supports this with:

- PID worker quality validation and retry (`CARVIS_REAL_PROVIDER_MAX_ATTEMPTS`)
- optional engineer continuation after a failed review (`CARVIS_ENGINEER_RUNS_AFTER_FAILED_REVIEW`)
- extraction of engineer fenced HTML into `output/game-preview.html`

## NixOS Verified

Remote test path:

```text
~/carvis-remote-smoke
```

Verified on NixOS:

- systemd user services active: `carvis-messagebus`, `carvis-agentruntime`, `carvis-electron`
- real DeepSeek Claude Code route works
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
