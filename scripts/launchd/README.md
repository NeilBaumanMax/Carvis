# Carvis launchd Manual Control

These scripts install a macOS LaunchAgent for manual Carvis control only.

The LaunchAgent is intentionally configured with:

```text
RunAtLoad=false
KeepAlive=false
```

This means Carvis will not start when macOS logs in and will not auto-restart if stopped.

## Commands

```bash
scripts/launchd/install.sh
scripts/launchd/start.sh
scripts/launchd/status.sh
scripts/launchd/stop.sh
scripts/launchd/uninstall.sh
```

Do not put a real `ANTHROPIC_AUTH_TOKEN` into the committed plist. Load secrets through your local shell or a private, ignored machine-local mechanism before starting real Claude mode.
