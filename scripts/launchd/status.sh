#!/usr/bin/env bash
set -euo pipefail

LABEL="com.carvis"
DOMAIN="gui/$(id -u)"

launchctl print "$DOMAIN/$LABEL"
