import { Result } from "@praha/byethrow";

import { parseCommandBuildTarget, type CommandBuildTarget } from "@/commands/build-target";

import { DOMAIN_ALERT_EVENT_NAME } from "../types/domain-alert-event";
import { resolveAlertsEventUrl } from "@/commands/web-api";

export type AlertEventHandler = (value: unknown) => void;
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

export type AlertEventTransportMap = Record<CommandBuildTarget, AlertEventTransport>;

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
    if (typeof EventSource === "undefined") {
      return noOpSubscription();
    }

    const source = new EventSource(resolveAlertsEventUrl());
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

const alertEventTransports: AlertEventTransportMap = {
  tauri: createTauriAlertEventTransport(),
  web: createWebAlertEventTransport(),
};

export const createAlertEventTransport = (): AlertEventTransport =>
  resolveAlertEventTransport(import.meta.env.VITE_ZAI_BUILD_TARGET, alertEventTransports);
