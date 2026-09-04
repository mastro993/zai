import { Result } from "@praha/byethrow";

import { parseCommandBuildTarget, type CommandBuildTarget } from "@/commands/build-target";
import { LIVE_EVENT_ALERTS } from "@/commands/web-api";
import { subscribeSharedLiveEvents } from "@/commands/web-live-events";
import { hasEventSource } from "@/lib/runtime-globals";

import { DOMAIN_ALERT_EVENT_NAME } from "../types/domain-alert-event";

export type AlertEventHandler = (payload: string) => void;
export type AlertEventReconnectHandler = () => void;

export interface AlertEventSubscription {
  ready: Promise<void>;
  close: () => void;
}

export interface AlertEventTransport {
  subscribe: (
    onEvent: AlertEventHandler,
    onReconnect: AlertEventReconnectHandler,
  ) => AlertEventSubscription;
}

export interface AlertEventTransportMap {
  tauri: AlertEventTransport;
  web: AlertEventTransport;
}

const noOpSubscription = (): AlertEventSubscription => ({
  ready: Promise.resolve(),
  close: () => undefined,
});

export const createTauriAlertEventTransport = (): AlertEventTransport => ({
  subscribe: (onEvent) => {
    let closed = false;
    let unlisten: (() => void) | undefined;

    const ready = import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<string>(DOMAIN_ALERT_EVENT_NAME, (event) => {
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

export const createWebAlertEventTransport = (): AlertEventTransport => ({
  subscribe: (onEvent, onReconnect) => {
    if (!hasEventSource()) {
      return noOpSubscription();
    }

    let hasOpened = false;
    const subscription = subscribeSharedLiveEvents(LIVE_EVENT_ALERTS, {
      onEvent,
      onOpen: () => {
        if (hasOpened) {
          onReconnect();
        }
        hasOpened = true;
      },
    });

    return {
      ready: Promise.resolve(),
      close: subscription.close,
    };
  },
});

export const selectAlertEventTransport = (
  buildTarget: CommandBuildTarget,
  transports: AlertEventTransportMap,
): AlertEventTransport => transports[buildTarget];

export const resolveAlertEventTransport = (
  buildTarget: string | undefined,
  transports: AlertEventTransportMap,
): AlertEventTransport => {
  const targetResult = parseCommandBuildTarget(buildTarget);
  return Result.isSuccess(targetResult)
    ? selectAlertEventTransport(targetResult.value, transports)
    : noOpSubscriptionTransport;
};

const noOpSubscriptionTransport: AlertEventTransport = {
  subscribe: () => noOpSubscription(),
};

const alertEventTransports = {
  tauri: createTauriAlertEventTransport(),
  web: createWebAlertEventTransport(),
} satisfies AlertEventTransportMap;

export const createAlertEventTransport = (): AlertEventTransport =>
  resolveAlertEventTransport(import.meta.env.VITE_ZAI_BUILD_TARGET, alertEventTransports);
