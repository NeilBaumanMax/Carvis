#!/usr/bin/env bash
set -euo pipefail

LABEL="com.carvis"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
echo "Stopped $LABEL."
