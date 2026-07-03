# carvis

Carvis is a local multi-agent Electron workflow for generating playable browser outputs and HTML reports from five visible roles. In real provider mode those roles currently use four retained provider worker processes because `writer` and `engineer` share one worker key.

## Current Runtime Shape

Production mode runs through `carvis-messagebus`, `carvis-agentruntime`, and `carvis-electron`.

Role routing:

- `manager`: DeepSeek through Claude Code CLI
- `writer`: DeepSeek through Claude Code CLI
- `artist`: Qwen OpenAI-compatible text route, plus Qwen Image through the local artist-image MCP wrapper
- `researcher`: DeepSeek OpenAI-compatible API, with Scrapling-collected web evidence injected before generation
- `engineer`: DeepSeek through Claude Code CLI

Provider workers are prewarmed and retained. `writer` and `engineer` intentionally share one provider worker key so engineer can resume the writer Claude Code session within the same non-fast/simple run, while the UI still shows them as separate roles. New runs and fast/simple tasks use isolated Claude sessions to avoid carrying old HTML or game context forward.

Speed modes are selectable in both Electron and the NAS web UI:

- `fast`: short output, one provider attempt, no default image generation.
- `auto`: detects simple tasks and avoids unnecessary images/long quality gates.
- `full`: keeps the full five-role behavior and image workflow.

## Collaboration Rules

The manager is a monitor/scope role, not a second review gate.

- `manager`, `writer`, `artist`, and `researcher` start in parallel after a command is submitted.
- Manager writes a short task boundary and abnormal-output watch list: empty files, `PROVIDER_ERROR`, fake tool calls, obvious laziness, missing role-critical material, or unrelated output.
- Writer produces short structured narrative or document content for engineer.
- Artist plans visual assets and can call the artist-image MCP wrapper to generate local `assets/artist-*.png` files.
- Researcher turns the task into state fields, mechanics, test checks, or repository facts.
- Engineer performs audit, conflict merge, and production together. If the roles disagree on names, dimensions, values, or scope, engineer unifies them and produces the final fenced `html` block.

The runtime supports this with:

- PID worker quality validation and retry (`CARVIS_REAL_PROVIDER_MAX_ATTEMPTS`)
- retained provider workers, with `writer`/`engineer` sharing a worker/session path within the same non-fast/simple run
- layered workplace context: `common/`, `skills/`, `task_state.json`, `handoff_to_engineer.json`, `evidence_index.json`
- provider usage recording in each role's `usage.json`
- extraction of engineer fenced HTML into `output/runs/<run>/game-preview.html`

## NixOS Verified

Remote test path:

```text
~/carvis-remote-smoke
```

Verified on NixOS:

- `carvis-messagebus.service`, `carvis-agentruntime.service`, and `carvis-electron.service` active
- four retained `providerWorker` processes active for five visible roles (`writer` and `engineer` share one worker)
- DeepSeek Claude Code route works for manager, writer, and engineer
- DeepSeek API route works for researcher; researcher search must cite Scrapling web evidence, not model-invented citations
- Qwen text route works for artist
- Qwen Image route works through artist-image MCP and writes local image assets
- recent regression tasks produced `output/runs/.../game-preview.html` and passed browser checks

Recent manual verification:

```bash
npm run build
npm run agentruntime:smoke
npm run workplaces:smoke
npm run output:smoke
npm run provider:smoke
```

## Runtime Artifacts

Each run writes role files under:

```text
workplaces/runs/<timestamp-request>/<role>/
```

Important files:

- `input.md`
- `common/role.md`
- `common/policy.md`
- `skills/*.md`
- `skills/selected.md`
- `plan.md`
- `result.md`
- `task_state.json`
- `handoff_to_engineer.json`
- `evidence_index.json`
- `usage.json`

Final outputs are written under:

```text
output/runs/<timestamp-request>/
```

Important files:

- `game-preview.html`
- `final-report.md`
- `manifest.json`
- `assets/artist-*.png`

## Provider Usage

Qwen OpenAI-compatible responses include real `prompt_tokens`, `completion_tokens`, and `total_tokens`.

DeepSeek through Claude Code CLI currently records `estimated_*_tokens`, because this route does not expose provider usage. The estimate is used for relative performance comparison, not billing.

## Secrets

No API keys are committed to this repository. Keep real keys in local env files such as `~/.config/carvis/agentruntime.env`.
