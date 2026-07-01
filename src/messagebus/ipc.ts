import { createServer, Socket, type Server } from "node:net";

import type { CarvisEventEnvelope } from "../shared/types/events.js";
import { createEnvelope } from "./bus.js";
import type {
  MessageBus,
  MessageBusEventHandler,
  MessageBusPublishInput,
  MessageBusPublishResult,
  MessageBusSubscribeOptions,
  MessageBusSubscription,
} from "./types.js";

type ClientMessage =
  | {
      kind: "subscribe";
      subscriptionId: string;
      options: MessageBusSubscribeOptions;
    }
  | {
      kind: "unsubscribe";
      subscriptionId: string;
    }
  | {
      kind: "publish";
      requestId: string;
      input: MessageBusPublishInput;
    };

type ServerMessage =
  | {
      kind: "event";
      subscriptionId: string;
      event: CarvisEventEnvelope;
    }
  | {
      kind: "publishResult";
      requestId: string;
      event: CarvisEventEnvelope;
      delivered: number;
    }
  | {
      kind: "error";
      requestId?: string;
      message: string;
    };

interface ServerSubscription {
  socket: Socket;
  subscriptionId: string;
  options: MessageBusSubscribeOptions;
}

export interface TcpMessageBusServer {
  port: number;
  close(): Promise<void>;
}

export async function startTcpMessageBusServer(port: number, host = "127.0.0.1"): Promise<TcpMessageBusServer> {
  const subscriptions = new Set<ServerSubscription>();
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    let buffer = "";

    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");

      while (true) {
        const newlineIndex = buffer.indexOf("\n");

        if (newlineIndex === -1) {
          break;
        }

        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        handleServerLine(line, socket, subscriptions);
      }
    });

    socket.on("close", () => {
      sockets.delete(socket);

      for (const subscription of [...subscriptions]) {
        if (subscription.socket === socket) {
          subscriptions.delete(subscription);
        }
      }
    });
  });

  await listen(server, port, host);
  const address = server.address();

  return {
    port: typeof address === "object" && address !== null ? address.port : port,
    close: async () => {
      for (const socket of sockets) {
        socket.destroy();
      }

      await closeServer(server);
    },
  };
}

export interface RemoteMessageBusOptions {
  host?: string;
  port: number;
}

export function createRemoteMessageBus(options: RemoteMessageBusOptions): MessageBus & { close(): void } {
  return new RemoteMessageBus(options.host ?? "127.0.0.1", options.port);
}

class RemoteMessageBus implements MessageBus {
  private socket: Socket | undefined;
  private buffer = "";
  private nextId = 1;
  private connectPromise: Promise<void> | undefined;
  private readonly subscriptions = new Map<
    string,
    {
      options: MessageBusSubscribeOptions;
      handler: MessageBusEventHandler;
    }
  >();
  private readonly pendingPublishes = new Map<
    string,
    {
      resolve: (result: MessageBusPublishResult) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {}

  async publish<TPayload>(
    input: MessageBusPublishInput<TPayload>,
  ): Promise<MessageBusPublishResult<TPayload>> {
    await this.connect();
    const requestId = `pub-${this.nextId++}`;

    return await new Promise<MessageBusPublishResult<TPayload>>((resolve, reject) => {
      this.pendingPublishes.set(requestId, {
        resolve: resolve as (result: MessageBusPublishResult) => void,
        reject,
      });
      this.send({
        kind: "publish",
        requestId,
        input,
      });
    });
  }

  subscribe<TPayload = unknown>(
    options: MessageBusSubscribeOptions,
    handler: MessageBusEventHandler<TPayload>,
  ): MessageBusSubscription {
    const subscriptionId = `sub-${this.nextId++}`;

    this.subscriptions.set(subscriptionId, {
      options,
      handler: handler as MessageBusEventHandler,
    });

    if (this.socket !== undefined) {
      this.send({
        kind: "subscribe",
        subscriptionId,
        options,
      });
    } else {
      void this.connect();
    }

    return {
      unsubscribe: () => {
        this.subscriptions.delete(subscriptionId);

        if (this.socket !== undefined) {
          this.send({
            kind: "unsubscribe",
            subscriptionId,
          });
        }
      },
    };
  }

  close(): void {
    this.socket?.destroy();
    this.socket = undefined;
  }

  private async connect(): Promise<void> {
    if (this.socket !== undefined) {
      return;
    }

    if (this.connectPromise !== undefined) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const socket = new Socket();

      socket.setEncoding("utf8");
      socket.once("error", reject);
      socket.connect(this.port, this.host, () => {
        socket.off("error", reject);
        socket.on("error", (error) => {
          this.rejectPending(error);
        });
        socket.on("data", (chunk: string) => {
          this.handleData(chunk);
        });
        socket.on("close", () => {
          this.socket = undefined;
          this.connectPromise = undefined;
        });

        this.socket = socket;

        for (const [subscriptionId, subscription] of this.subscriptions) {
          this.send({
            kind: "subscribe",
            subscriptionId,
            options: subscription.options,
          });
        }

        resolve();
      });
    });

    return this.connectPromise;
  }

  private send(message: ClientMessage): void {
    this.socket?.write(`${JSON.stringify(message)}\n`);
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;

    while (true) {
      const newlineIndex = this.buffer.indexOf("\n");

      if (newlineIndex === -1) {
        break;
      }

      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    if (line.trim().length === 0) {
      return;
    }

    const message = JSON.parse(line) as ServerMessage;

    if (message.kind === "event") {
      const subscription = this.subscriptions.get(message.subscriptionId);
      void subscription?.handler(message.event);
      return;
    }

    if (message.kind === "publishResult") {
      const pending = this.pendingPublishes.get(message.requestId);
      this.pendingPublishes.delete(message.requestId);
      pending?.resolve({
        event: message.event,
        delivered: message.delivered,
      });
      return;
    }

    const error = new Error(message.message);
    if (message.requestId !== undefined) {
      const pending = this.pendingPublishes.get(message.requestId);
      this.pendingPublishes.delete(message.requestId);
      pending?.reject(error);
    }
  }

  private rejectPending(error: Error): void {
    for (const [requestId, pending] of this.pendingPublishes) {
      this.pendingPublishes.delete(requestId);
      pending.reject(error);
    }
  }
}

function handleServerLine(
  line: string,
  socket: Socket,
  subscriptions: Set<ServerSubscription>,
): void {
  if (line.trim().length === 0) {
    return;
  }

  try {
    const message = JSON.parse(line) as ClientMessage;

    if (message.kind === "subscribe") {
      subscriptions.add({
        socket,
        subscriptionId: message.subscriptionId,
        options: message.options,
      });
      return;
    }

    if (message.kind === "unsubscribe") {
      for (const subscription of [...subscriptions]) {
        if (subscription.socket === socket && subscription.subscriptionId === message.subscriptionId) {
          subscriptions.delete(subscription);
        }
      }
      return;
    }

    const event = createEnvelope(message.input);
    let delivered = 0;

    for (const subscription of subscriptions) {
      if (!matches(subscription.options, event)) {
        continue;
      }

      delivered += 1;
      writeServerMessage(subscription.socket, {
        kind: "event",
        subscriptionId: subscription.subscriptionId,
        event,
      });
    }

    writeServerMessage(socket, {
      kind: "publishResult",
      requestId: message.requestId,
      event,
      delivered,
    });
  } catch (error) {
    writeServerMessage(socket, {
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function matches(options: MessageBusSubscribeOptions, event: CarvisEventEnvelope): boolean {
  if (options.type !== undefined && options.type !== event.type) {
    return false;
  }

  if (options.source !== undefined && options.source !== event.source) {
    return false;
  }

  if (options.target !== undefined && options.target !== event.target) {
    return false;
  }

  return true;
}

function writeServerMessage(socket: Socket, message: ServerMessage): void {
  socket.write(`${JSON.stringify(message)}\n`);
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
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
