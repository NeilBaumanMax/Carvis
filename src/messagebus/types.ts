import type {
  CarvisEventEnvelope,
  CarvisEventSource,
  CarvisEventType,
} from "../shared/types/events.js";

export type MessageBusEventHandler<TPayload = unknown> = (
  event: CarvisEventEnvelope<TPayload>,
) => void | Promise<void>;

export interface MessageBusSubscription {
  unsubscribe(): void;
}

export interface MessageBusSubscribeOptions {
  type?: CarvisEventType;
  target?: CarvisEventSource;
  source?: CarvisEventSource;
}

export type MessageBusPublishInput<TPayload = unknown> = Omit<
  CarvisEventEnvelope<TPayload>,
  "eventId" | "timestamp"
> &
  Partial<Pick<CarvisEventEnvelope<TPayload>, "eventId" | "timestamp">>;

export interface MessageBusPublishResult<TPayload = unknown> {
  event: CarvisEventEnvelope<TPayload>;
  delivered: number;
}

export interface MessageBus {
  publish<TPayload>(input: MessageBusPublishInput<TPayload>): Promise<MessageBusPublishResult<TPayload>>;
  subscribe<TPayload = unknown>(
    options: MessageBusSubscribeOptions,
    handler: MessageBusEventHandler<TPayload>,
  ): MessageBusSubscription;
}
