# Carvis macOS App Launcher

Open Carvis like a normal app by double-clicking:

```text
macos/Carvis.app
```

The app launcher starts Carvis manually. It does not configure login startup.

Logs:

```text
~/Library/Logs/Carvis/app.log
```

Manual commands:

```bash
scripts/macos/open-carvis.sh
scripts/macos/status-carvis.sh
scripts/macos/stop-carvis.sh
```

Put your DeepSeek API key into:

```text
secrets/deepseek-api-key.txt
```

That file is ignored by git.
