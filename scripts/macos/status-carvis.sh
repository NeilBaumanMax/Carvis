#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="$HOME/Library/Application Support/Carvis"
PID_FILE="$STATE_DIR/carvis.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Carvis is not running."
  exit 1
fi

pid="$(cat "$PID_FILE")"

if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
  echo "Carvis is running with pid $pid"
else
  echo "Carvis pid file exists, but pid $pid is not running."
  exit 1
fi
