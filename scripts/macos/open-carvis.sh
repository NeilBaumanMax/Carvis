#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="$HOME/Library/Application Support/Carvis"
LOG_DIR="$HOME/Library/Logs/Carvis"
PID_FILE="$STATE_DIR/carvis.pid"
LOG_FILE="$LOG_DIR/app.log"

mkdir -p "$STATE_DIR" "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  existing_pid="$(cat "$PID_FILE")"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "Carvis is already running with pid $existing_pid"
    exit 0
  fi
fi

cd "$ROOT_DIR"
npm run build >>"$LOG_FILE" 2>&1

(
  export CARVIS_SETUP_MODE=spawn
  export CARVIS_SETUP_HOLD_OPEN=1
  exec node dist/main.js
) >>"$LOG_FILE" 2>&1 &

echo "$!" > "$PID_FILE"
echo "Started Carvis with pid $(cat "$PID_FILE")"
