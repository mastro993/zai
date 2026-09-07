import { Result } from "@praha/byethrow";

import { parseCommandBuildTarget, type CommandBuildTarget } from "@/commands/build-target";
import { LIVE_EVENT_CURRENCY } from "@/commands/web-api";
import { subscribeSharedLiveEvents } from "@/commands/web-live-events";
import { hasEventSource } from "@/lib/runtime-globals";

import { CURRENCY_STATE_EVENT_NAME } from "../types/currency-state-event";

export type CurrencyStateEventHandler = (payload: string) => void;
export type CurrencyStateEventReconnectHandler = () => void;
export type CurrencyStateEventFailureCode =
  | "subscription_failed"
  | "subscription_unavailable"
  | "subscription_closed"
  | "invalid_build_target";

export class CurrencyStateEventError extends Error {
  override readonly name = "CurrencyStateEventError";

  constructor(
    readonly code: CurrencyStateEventFailureCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
  }
}

export type CurrencyStateEventFailureHandler = (error: CurrencyStateEventError) => void;

export interface CurrencyStateEventSubscription {
  ready: Result.ResultAsync<void, CurrencyStateEventError>;
  close: () => void;
}

export interface CurrencyStateEventTransport {
  subscribe: (
    onEvent: CurrencyStateEventHandler,
    onReconnect: CurrencyStateEventReconnectHandler,
    onFailure?: CurrencyStateEventFailureHandler,
  ) => CurrencyStateEventSubscription;
}

export type CurrencyStateEventTransportMap = Record<
  CommandBuildTarget,
  CurrencyStateEventTransport
>;

const failedSubscription = (error: CurrencyStateEventError): CurrencyStateEventSubscription => ({
  ready: Promise.resolve(Result.fail(error)),
  close: () => undefined,
});

const subscriptionFailure = (cause: unknown): CurrencyStateEventError =>
  new CurrencyStateEventError(
    "subscription_failed",
    "Currency state updates could not be subscribed to.",
    cause,
  );

export const createTauriCurrencyStateEventTransport = (): CurrencyStateEventTransport => ({
  subscribe: (onEvent, _onReconnect, onFailure) => {
    let closed = false;
    let unlisten: (() => void) | undefined;

    const ready = Result.try({
      try: async () => {
        const { listen } = await import("@tauri-apps/api/event");
        const dispose = await listen<string>(CURRENCY_STATE_EVENT_NAME, (event) => {
          if (!closed) {
            const result = Result.try({
              try: () => onEvent(event.payload),
              catch: subscriptionFailure,
            });
            if (Result.isFailure(result)) {
              onFailure?.(result.error);
            }
          }
        });
        unlisten = dispose;
        if (closed) {
          const result = Result.try({ try: dispose, catch: subscriptionFailure });
          if (Result.isFailure(result)) {
            onFailure?.(result.error);
          }
        }
      },
      catch: subscriptionFailure,
    });

    return {
      ready,
      close: () => {
        closed = true;
        unlisten?.();
      },
    };
  },
});

export const createWebCurrencyStateEventTransport = (): CurrencyStateEventTransport => ({
  subscribe: (onEvent, onReconnect, onFailure) => {
    if (!hasEventSource()) {
      return failedSubscription(
        new CurrencyStateEventError(
          "subscription_unavailable",
          "Currency state updates are unavailable in this runtime.",
        ),
      );
    }

    let hasOpened = false;
    let hadError = false;
    let readySettled = false;
    let resolveReady: (result: Result.Result<void, CurrencyStateEventError>) => void;
    const ready = new Promise<Result.Result<void, CurrencyStateEventError>>((resolve) => {
      resolveReady = resolve;
    });
    const settleReady = (result: Result.Result<void, CurrencyStateEventError>) => {
      if (!readySettled) {
        readySettled = true;
        resolveReady(result);
      }
    };

    const sourceResult = Result.try({
      try: () =>
        subscribeSharedLiveEvents(LIVE_EVENT_CURRENCY, {
          onEvent,
          onOpen: () => {
            if (hasOpened || hadError) {
              onReconnect();
            }
            hasOpened = true;
            settleReady(Result.succeed(undefined));
          },
          onError: () => {
            const error = subscriptionFailure(new Error("EventSource connection failed"));
            hadError = true;
            if (!hasOpened) {
              settleReady(Result.fail(error));
            } else {
              onFailure?.(error);
            }
          },
        }),
      catch: (cause) =>
        new CurrencyStateEventError(
          "subscription_failed",
          "Currency state updates could not be subscribed to.",
          cause,
        ),
    });
    if (Result.isFailure(sourceResult)) {
      return failedSubscription(sourceResult.error);
    }

    const subscription = sourceResult.value;
    return {
      ready,
      close: () => {
        subscription.close();
        settleReady(
          Result.fail(
            new CurrencyStateEventError(
              "subscription_closed",
              "Currency state updates subscription closed.",
            ),
          ),
        );
      },
    };
  },
});

export const resolveCurrencyStateEventTransport = (
  buildTarget: string | undefined,
  transports: CurrencyStateEventTransportMap,
): CurrencyStateEventTransport => {
  const targetResult = parseCommandBuildTarget(buildTarget);
  return Result.isSuccess(targetResult)
    ? transports[targetResult.value]
    : {
        subscribe: () =>
          failedSubscription(
            new CurrencyStateEventError("invalid_build_target", targetResult.error.message),
          ),
      };
};

const currencyStateEventTransports = {
  tauri: createTauriCurrencyStateEventTransport(),
  web: createWebCurrencyStateEventTransport(),
} satisfies CurrencyStateEventTransportMap;

export const createCurrencyStateEventTransport = (): CurrencyStateEventTransport =>
  resolveCurrencyStateEventTransport(
    import.meta.env.VITE_ZAI_BUILD_TARGET,
    currencyStateEventTransports,
  );
