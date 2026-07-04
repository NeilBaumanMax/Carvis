#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="$HOME/Library/Application Support/Carvis"
PID_FILE="$STATE_DIR/carvis.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Carvis is not running."
  exit 0
fi

pid="$(cat "$PID_FILE")"

if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
  kill -TERM "$pid"
  echo "Stopped Carvis pid $pid"
else
  echo "Carvis pid $pid is not running."
fi

rm -f "$PID_FILE"
