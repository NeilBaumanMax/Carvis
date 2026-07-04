#!/usr/bin/env bash
set -euo pipefail

LABEL="com.carvis"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

if [[ ! -f "$PLIST_DST" ]]; then
  echo "Missing $PLIST_DST. Run scripts/launchd/install.sh first." >&2
  exit 1
fi

launchctl bootstrap "$DOMAIN" "$PLIST_DST" 2>/dev/null || true
launchctl kickstart -k "$DOMAIN/$LABEL"
echo "Started $LABEL manually."
