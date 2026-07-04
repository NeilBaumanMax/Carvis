#!/usr/bin/env bash
set -euo pipefail

LABEL="com.carvis"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
rm -f "$PLIST_DST"
echo "Uninstalled $LABEL."
