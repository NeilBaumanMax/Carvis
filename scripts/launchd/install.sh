#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLIST_SRC="$ROOT_DIR/launchd/com.carvis.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.carvis.plist"
LOG_DIR="$HOME/Library/Logs/Carvis"

mkdir -p "$(dirname "$PLIST_DST")" "$LOG_DIR"
cp "$PLIST_SRC" "$PLIST_DST"
plutil -lint "$PLIST_DST" >/dev/null

echo "Installed $PLIST_DST"
echo "Carvis is NOT configured to start at login."
echo "Start manually with: scripts/launchd/start.sh"
