#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <host> [user] [remote-dir]" >&2
  exit 2
fi

host="$1"
user="${2:-howtion}"
remote_dir="${3:-~/carvis-remote-smoke}"
ssh_target="${user}@${host}"

if [[ -z "${DEEPSEEK_API_KEY:-}" && -z "${ANTHROPIC_AUTH_TOKEN:-}" ]]; then
  echo "DEEPSEEK_API_KEY or ANTHROPIC_AUTH_TOKEN is required for real MVP smoke" >&2
  exit 2
fi

ssh_command=(ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
rsync_ssh_command=(ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)

if [[ -n "${CARVIS_SSH_PASSWORD:-}" ]]; then
  ssh_command=(sshpass -p "$CARVIS_SSH_PASSWORD" "${ssh_command[@]}")
  rsync_ssh_command=(sshpass -p "$CARVIS_SSH_PASSWORD" "${rsync_ssh_command[@]}")
fi

ssh_base=("${ssh_command[@]}" "$ssh_target")
rsync_base=(rsync -az --delete --exclude .git --exclude node_modules --exclude dist -e "$(printf '%q ' "${rsync_ssh_command[@]}")")

"${ssh_base[@]}" "mkdir -p ${remote_dir}"
"${rsync_base[@]}" ./ "${ssh_target}:${remote_dir}/"

"${ssh_base[@]}" "cd ${remote_dir} && rm -rf node_modules dist && npm ci --ignore-scripts --no-audit --no-fund && npm test"

claude_bin="$("${ssh_base[@]}" "find ~/.npm/_npx -path '*/@anthropic-ai/claude-code-linux-x64/claude' -type f | head -1")"

if [[ -z "$claude_bin" ]]; then
  "${ssh_base[@]}" "cd ${remote_dir} && npx -y @anthropic-ai/claude-code --version >/dev/null 2>&1 || true"
  claude_bin="$("${ssh_base[@]}" "find ~/.npm/_npx -path '*/@anthropic-ai/claude-code-linux-x64/claude' -type f | head -1")"
fi

if [[ -z "$claude_bin" ]]; then
  echo "could not locate Claude Code linux binary on remote host" >&2
  exit 1
fi

secret="${DEEPSEEK_API_KEY:-${ANTHROPIC_AUTH_TOKEN:-}}"

remote_proxy_env=""
if [[ -n "${CARVIS_REMOTE_HTTPS_PROXY:-}" ]]; then
  remote_proxy_env+=" HTTPS_PROXY=$(printf '%q' "$CARVIS_REMOTE_HTTPS_PROXY") https_proxy=$(printf '%q' "$CARVIS_REMOTE_HTTPS_PROXY")"
fi
if [[ -n "${CARVIS_REMOTE_HTTP_PROXY:-}" ]]; then
  remote_proxy_env+=" HTTP_PROXY=$(printf '%q' "$CARVIS_REMOTE_HTTP_PROXY") http_proxy=$(printf '%q' "$CARVIS_REMOTE_HTTP_PROXY")"
fi

printf '%s\n' "$secret" | "${ssh_base[@]}" "read -r DSKEY; cd ${remote_dir} &&${remote_proxy_env} CARVIS_REAL_MVP_SMOKE=1 CARVIS_REAL_MVP_TIMEOUT_MS=\"${CARVIS_REAL_MVP_TIMEOUT_MS:-180000}\" CARVIS_CLAUDE_CODE_BARE=\"${CARVIS_CLAUDE_CODE_BARE:-0}\" DEEPSEEK_API_KEY=\"\$DSKEY\" CARVIS_CLAUDE_CODE_RUNNER=steam-run CARVIS_CLAUDE_CODE_BIN='${claude_bin}' npm run mvp:real-smoke"
