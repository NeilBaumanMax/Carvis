import { randomUUID } from "node:crypto";

import type { CarvisEventEnvelope } from "../shared/types/events.js";
import type {
  MessageBus,
  MessageBusEventHandler,
  MessageBusPublishInput,
  MessageBusPublishResult,
  MessageBusSubscribeOptions,
  MessageBusSubscription,
} from "./types.js";

interface RegisteredSubscription {
  options: MessageBusSubscribeOptions;
  handler: MessageBusEventHandler;
}

export class InMemoryMessageBus implements MessageBus {
  private readonly subscriptions = new Set<RegisteredSubscription>();

  async publish<TPayload>(
    input: MessageBusPublishInput<TPayload>,
  ): Promise<MessageBusPublishResult<TPayload>> {
    const event = createEnvelope(input);
    const deliveries = matchingSubscriptions(this.subscriptions, event);

    for (const subscription of deliveries) {
      await subscription.handler(event);
    }

    return {
      event,
      delivered: deliveries.length,
    };
  }

  subscribe<TPayload = unknown>(
    options: MessageBusSubscribeOptions,
    handler: MessageBusEventHandler<TPayload>,
  ): MessageBusSubscription {
    const subscription: RegisteredSubscription = {
      options,
      handler: handler as MessageBusEventHandler,
    };

    this.subscriptions.add(subscription);

    return {
      unsubscribe: () => {
        this.subscriptions.delete(subscription);
      },
    };
  }
}

export function createMessageBus(): MessageBus {
  return new InMemoryMessageBus();
}

export function createEnvelope<TPayload>(
  input: MessageBusPublishInput<TPayload>,
): CarvisEventEnvelope<TPayload> {
  return {
    ...input,
    eventId: input.eventId ?? randomUUID(),
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

function matchingSubscriptions(
  subscriptions: ReadonlySet<RegisteredSubscription>,
  event: CarvisEventEnvelope,
): RegisteredSubscription[] {
  return [...subscriptions].filter((subscription) => matches(subscription.options, event));
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
