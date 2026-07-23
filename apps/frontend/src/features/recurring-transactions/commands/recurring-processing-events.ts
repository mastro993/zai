import { Result } from "@praha/byethrow";

import { parseCommandBuildTarget, type CommandBuildTarget } from "@/commands/build-target";
import { resolveRecurringProcessingEventUrl } from "@/commands/web-api";

import { RECURRING_PROCESSING_EVENT_NAME } from "../types/recurring-processing-event";

export type RecurringProcessingEventHandler = (value: unknown) => void;
export type RecurringProcessingEventReconnectHandler = () => void;

export interface RecurringProcessingEventSubscription {
  ready: Promise<void>;
  close: () => void;
}

export interface RecurringProcessingEventTransport {
  subscribe: (
    onEvent: RecurringProcessingEventHandler,
    onReconnect: RecurringProcessingEventReconnectHandler,
  ) => RecurringProcessingEventSubscription;
}

export type RecurringProcessingEventTransportMap = Record<
  CommandBuildTarget,
  RecurringProcessingEventTransport
>;

const noOpSubscription = (): RecurringProcessingEventSubscription => ({
  ready: Promise.resolve(),
  close: () => undefined,
});

export const createTauriRecurringProcessingEventTransport =
  (): RecurringProcessingEventTransport => ({
    subscribe: (onEvent) => {
      let closed = false;
      let unlisten: (() => void) | undefined;

      const ready = import("@tauri-apps/api/event")
        .then(({ listen }) =>
          listen<string>(RECURRING_PROCESSING_EVENT_NAME, (event) => {
            if (!closed) {
              onEvent(event.payload);
            }
          }),
        )
        .then((dispose) => {
          unlisten = dispose;
          if (closed) {
            dispose();
          }
        })
        .catch(() => undefined);

      return {
        ready,
        close: () => {
          closed = true;
          unlisten?.();
        },
      };
    },
  });

export const createWebRecurringProcessingEventTransport =
  (): RecurringProcessingEventTransport => ({
    subscribe: (onEvent, onReconnect) => {
      if (typeof EventSource === "undefined") {
        return noOpSubscription();
      }

      const source = new EventSource(resolveRecurringProcessingEventUrl());
      let hasOpened = false;
      const handleMessage = (event: Event) => onEvent((event as MessageEvent<string>).data);
      const handleOpen = () => {
        if (hasOpened) {
          onReconnect();
        }
        hasOpened = true;
      };
      source.addEventListener("message", handleMessage);
      source.addEventListener("open", handleOpen);

      return {
        ready: Promise.resolve(),
        close: () => {
          source.removeEventListener("message", handleMessage);
          source.removeEventListener("open", handleOpen);
          source.close();
        },
      };
    },
  });

export const selectRecurringProcessingEventTransport = (
  buildTarget: CommandBuildTarget,
  transports: RecurringProcessingEventTransportMap,
): RecurringProcessingEventTransport => transports[buildTarget];

export const resolveRecurringProcessingEventTransport = (
  buildTarget: string | undefined,
  transports: RecurringProcessingEventTransportMap,
): RecurringProcessingEventTransport => {
  const targetResult = parseCommandBuildTarget(buildTarget);
  return Result.isSuccess(targetResult)
    ? selectRecurringProcessingEventTransport(targetResult.value, transports)
    : noOpSubscriptionTransport;
};

const noOpSubscriptionTransport: RecurringProcessingEventTransport = {
  subscribe: () => noOpSubscription(),
};

const recurringProcessingEventTransports: RecurringProcessingEventTransportMap = {
  tauri: createTauriRecurringProcessingEventTransport(),
  web: createWebRecurringProcessingEventTransport(),
};

export const createRecurringProcessingEventTransport = (): RecurringProcessingEventTransport =>
  resolveRecurringProcessingEventTransport(
    import.meta.env.VITE_ZAI_BUILD_TARGET,
    recurringProcessingEventTransports,
  );
