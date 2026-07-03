import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";

import type { ElectronShell } from "./shell.js";
import type { ElectronRemoteAccess } from "./types.js";

export interface ElectronRemoteApiHandle {
  access: ElectronRemoteAccess;
  close(): Promise<void>;
}

export async function startElectronRemoteApi(shell: ElectronShell): Promise<ElectronRemoteApiHandle> {
  const host = process.env.CARVIS_ELECTRON_REMOTE_API_HOST ?? "0.0.0.0";
  const port = readPort(process.env.CARVIS_ELECTRON_REMOTE_API_PORT, 45932);
  const phonePort = readPort(process.env.CARVIS_NAS_PORT, 8765);
  const ip = process.env.CARVIS_LAN_IP ?? findLanIp() ?? "127.0.0.1";
  const electronApiUrl = process.env.CARVIS_ELECTRON_API_PUBLIC_URL ?? `http://${ip}:${port}`;
  const phoneUrl = process.env.CARVIS_NAS_PUBLIC_URL ?? process.env.CARVIS_NGINX_URL ?? `http://${ip}:${phonePort}`;

  const server = createServer((request, response) => {
    void handleRequest(shell, request, response);
  });

  await listen(server, port, host);

  const access = {
    ip,
    electronApiUrl,
    phoneUrl,
  };
  shell.setRemoteAccess(access);

  return {
    access,
    close: () => closeServer(server),
  };
}

async function handleRequest(
  shell: ElectronShell,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      writeJson(response, 200, { ok: true, service: "carvis-electron-api" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/state") {
      writeJson(response, 200, shell.getState());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/input") {
      const payload = await readJsonBody<{ text?: unknown }>(request);
      const text = typeof payload.text === "string" ? payload.text : "";
      shell.setRemoteDraft(text, "nas");
      writeJson(response, 200, { ok: true, text });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/submit") {
      const payload = await readJsonBody<{ text?: unknown; requestId?: unknown }>(request);
      const text =
        typeof payload.text === "string" && payload.text.trim().length > 0
          ? payload.text
          : shell.getState().remoteDraft?.text ?? "";
      const requestId = typeof payload.requestId === "string" ? payload.requestId : undefined;

      shell.setRemoteDraft(text, "nas");
      await shell.submitCommand(text, { requestId });
      writeJson(response, 200, { ok: true, text });
      return;
    }

    writeJson(response, 404, { ok: false, error: "not_found" });
  } catch (error) {
    writeJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readPort(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function findLanIp(): string | undefined {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }

  return undefined;
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
