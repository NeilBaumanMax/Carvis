# Carvis NAS

`nas/` 是 Carvis 的手机远程控制端，和外部 Electron 应用同级放在 `carvis/` 下。

## 能力

- 手机 Web 输入文字时，实时调用 NAS `POST /api/input`，再转发到 Electron `POST /api/input`。
- 手机点击启动时，NAS 调用 Electron `POST /api/submit`，Electron 与 agentruntime 开始协同。
- NAS 只在 `config/paths.yaml` 记录真实 `output/history` 路径，不复制产物。
- Go server 按白名单读取 output/history，提供 txt、md、html、pdf、docx、xlsx、csv、json 等移动端预览入口。

## 本地启动

```bash
cd nas
go run ./apps/server
```

默认地址：

- 手机 Web：`http://<局域网 IP>:8765`
- Electron API：`http://127.0.0.1:45932`

可用环境变量覆盖：

- `CARVIS_NAS_PUBLIC_URL`
- `CARVIS_NGINX_URL`
- `CARVIS_ELECTRON_API_URL`
- `CARVIS_OUTPUT_ROOT`
- `CARVIS_HISTORY_ROOT`
