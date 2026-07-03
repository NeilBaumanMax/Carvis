# carvis

Carvis is a local multi-agent Electron workflow for generating playable browser outputs and HTML reports from five visible roles. In real provider mode those roles currently use four retained provider worker processes because `writer` and `engineer` share one worker key.

## Version

Current package version: `1.1.0`.

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

## Current NixOS Deployment

Remote runtime directory:

```text
/home/howtion/carvis-remote-smoke
```

Current WiFi entrypoint for phones or other devices on the same WiFi:

```text
http://192.168.135.250:8765
```

Current network facts:

- `wlan0`: `192.168.135.250/24`
- WiFi default route is preferred over wired route.
- NAS phone web listens on `*:8765`.
- Electron HTTP API listens on `0.0.0.0:45932`.
- Messagebus listens on `127.0.0.1:45931`.

Current NixOS generation verified after reboot:

```text
24
```

The permanent NixOS configuration includes:

- `networking.firewall.allowedTCPPorts = [ 8765 45932 ];`
- `go` in `environment.systemPackages`

The current user services are enabled:

- `carvis.target`
- `carvis-messagebus.service`
- `carvis-agentruntime.service`
- `carvis-electron.service`
- `carvis-nas.service`

`carvis.target` uses `Wants=` for the four services so a short NAS self-repair restart does not leave the target in a dependency-failed state. Each service is also individually enabled.

User linger is enabled for `howtion`, so the user services can start at boot:

```bash
loginctl show-user howtion -p Linger
```

## NAS Startup Hardening

NAS is backed by a Go server:

```text
/home/howtion/carvis-remote-smoke/nas/carvis-nas-server
```

`carvis-nas.service` has this startup repair drop-in:

```text
/home/howtion/.config/systemd/user/carvis-nas.service.d/10-ensure-server.conf
```

It runs:

```text
/home/howtion/.local/bin/carvis-nas-ensure-server
```

The script checks the NAS server binary before startup:

- If `nas/carvis-nas-server` exists and is current, it starts normally.
- If system `go` exists, it rebuilds `nas/carvis-nas-server` from `nas/apps/server`.
- If Go rebuild is unavailable, it restores the binary from:

```text
/home/howtion/.local/bin/carvis-nas-server.backup
```

The phone web UI copy now uses end-user language:

- `WiFi 入口`
- `任务输入`
- `当前输出`
- `历史任务`
- `Carvis 主屏`

It no longer exposes Electron as a user-facing concept.

## Collaboration Rules

The manager is a monitor/scope role with two fixed handoffs, not a repeating letter loop.

- Manager first writes a short task boundary and abnormal-output watch list: empty files, `PROVIDER_ERROR`, fake tool calls, obvious laziness, missing role-critical material, or unrelated output.
- `writer`, `artist`, and `researcher` then run in parallel.
- Writer produces short structured narrative or document content for engineer.
- Artist plans stable visual assets and can call the artist-image MCP wrapper to generate local `assets/artist-*.png` files. Planned filenames are emitted before generation finishes so engineer can reference fixed paths.
- Researcher turns the task into state fields, mechanics, test checks, or repository facts.
- Manager runs one review/handoff stage after writer/artist/researcher finish, then stops.
- Engineer performs audit, conflict merge, and production together. If the roles disagree on names, dimensions, values, or scope, engineer unifies them and produces the final fenced `html` block.

The runtime supports this with:

- PID worker quality validation and retry (`CARVIS_REAL_PROVIDER_MAX_ATTEMPTS`)
- retained provider workers, with `writer`/`engineer` sharing a worker/session path within the same non-fast/simple run
- layered workplace context: `common/`, `skills/`, `task_state.json`, `handoff_to_engineer.json`, `evidence_index.json`
- provider usage recording in each role's `usage.json`
- extraction of engineer fenced HTML into `output/runs/<run>/game-preview.html`
- image progress heartbeats such as `artist images: planned 3, 2 active, 1/3 completed, 0 failed, 0 retrying`

## NixOS Verified

Remote test path:

```text
~/carvis-remote-smoke
```

Verified on NixOS:

- `carvis-messagebus.service`, `carvis-agentruntime.service`, and `carvis-electron.service` active
- `carvis-nas.service` active
- `carvis.target` active after the latest restart validation
- NAS phone web is active on WiFi at `http://192.168.135.250:8765`
- permanent NixOS firewall opens TCP `8765` for NAS and TCP `45932` for the Electron HTTP API
- system `go` is available for rebuilding `nas/carvis-nas-server`
- `carvis-nas.service` verifies or rebuilds the NAS binary before startup, with a local backup fallback at `~/.local/bin/carvis-nas-server.backup`
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

Recent NixOS boot verification:

```bash
sudo nixos-rebuild boot
sudo reboot
systemctl --user is-active carvis.target carvis-messagebus.service carvis-agentruntime.service carvis-electron.service carvis-nas.service
ss -ltnp | grep -E ':(45931|45932|8765)\b'
curl http://192.168.135.250:8765/api/config
curl http://127.0.0.1:45932/api/health
```

Expected checks:

- `carvis.target` and all four Carvis services are `active`.
- `api/config` returns `publicUrl=http://192.168.135.250:8765`.
- `api/health` returns `{"ok":true,"service":"carvis-electron-api"}`.

## Useful Operations

Restart all Carvis user services:

```bash
systemctl --user restart carvis.target
```

Restart only the phone web path:

```bash
systemctl --user restart carvis-nas.service carvis-electron.service
```

Check service logs:

```bash
journalctl --user -u carvis-nas.service -u carvis-electron.service -n 120 --no-pager
```

Check the current WiFi address:

```bash
ip -4 -br addr show wlan0
```

Check the permanent NixOS firewall declaration:

```bash
grep -n 'allowedTCPPorts' /etc/nixos/configuration.nix
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
