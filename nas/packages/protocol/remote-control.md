# Carvis NAS Protocol

## Electron API

- `POST /api/input` with `{ "text": "..." }`: update Electron input draft in real time.
- `POST /api/submit` with `{ "text": "...", "requestId": "optional" }`: submit one collaboration task.
- `GET /api/state`: read Electron shell state.

## NAS API

- `POST /api/input`: phone page writes a draft; NAS forwards it to Electron.
- `POST /api/submit`: phone page starts collaboration; NAS forwards it to Electron.
- `GET /api/history`: list whitelisted output/history folders.
- `GET /api/files?root=output&path=<relative-folder>`: list files under a whitelisted root.
- `GET /preview?root=output&path=<relative-file>`: mobile preview for txt, md, html, pdf, docx, xlsx, csv, json.
