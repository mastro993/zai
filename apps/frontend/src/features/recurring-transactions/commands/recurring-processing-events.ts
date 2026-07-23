import { Result } from "@praha/byethrow";

import { parseCommandBuildTarget, type CommandBuildTarget } from "@/commands/build-target";
import { resolveRecurringProcessingEventUrl } from "@/commands/web-api";

import { RECURRING_PROCESSING_EVENT_NAME } from "../types/recurring-processing-event";

export type RecurringProcessingEventHandler = (value: unknown) => void;
export type RecurringProcessingEventReconnectHandler = () => void;
export type RecurringProcessingEventFailureCode =
  | "subscription_failed"
  | "subscription_unavailable"
  | "subscription_closed"
  | "invalid_build_target";

export class RecurringProcessingEventError extends Error {
  override readonly name = "RecurringProcessingEventError";

  constructor(
    readonly code: RecurringProcessingEventFailureCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
  }
}

export type RecurringProcessingEventFailureHandler = (error: RecurringProcessingEventError) => void;

export interface RecurringProcessingEventSubscription {
  ready: Result.ResultAsync<void, RecurringProcessingEventError>;
  close: () => void;
}

export interface RecurringProcessingEventTransport {
  subscribe: (
    onEvent: RecurringProcessingEventHandler,
    onReconnect: RecurringProcessingEventReconnectHandler,
    onFailure?: RecurringProcessingEventFailureHandler,
  ) => RecurringProcessingEventSubscription;
}

export type RecurringProcessingEventTransportMap = Record<
  CommandBuildTarget,
  RecurringProcessingEventTransport
>;

const failedSubscription = (
  error: RecurringProcessingEventError,
): RecurringProcessingEventSubscription => ({
  ready: Promise.resolve(Result.fail(error)),
  close: () => undefined,
});

const subscriptionFailure = (cause: unknown): RecurringProcessingEventError =>
  new RecurringProcessingEventError(
    "subscription_failed",
    "Recurring processing updates could not be subscribed to.",
    cause,
  );

export const createTauriRecurringProcessingEventTransport =
  (): RecurringProcessingEventTransport => ({
    subscribe: (onEvent, _onReconnect, onFailure) => {
      let closed = false;
      let unlisten: (() => void) | undefined;

      const ready = Result.try({
        try: async () => {
          const { listen } = await import("@tauri-apps/api/event");
          const dispose = await listen<string>(RECURRING_PROCESSING_EVENT_NAME, (event) => {
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

export const createWebRecurringProcessingEventTransport =
  (): RecurringProcessingEventTransport => ({
    subscribe: (onEvent, onReconnect, onFailure) => {
      const sourceResult =
        typeof EventSource === "undefined"
          ? Result.fail(
              new RecurringProcessingEventError(
                "subscription_unavailable",
                "Recurring processing updates are unavailable in this runtime.",
              ),
            )
          : Result.try({
              try: () => new EventSource(resolveRecurringProcessingEventUrl()),
              catch: (cause) =>
                new RecurringProcessingEventError(
                  "subscription_failed",
                  "Recurring processing updates could not be subscribed to.",
                  cause,
                ),
            });
      if (Result.isFailure(sourceResult)) {
        return failedSubscription(sourceResult.error);
      }

      const source = sourceResult.value;
      let hasOpened = false;
      let hadError = false;
      let readySettled = false;
      let resolveReady: (result: Result.Result<void, RecurringProcessingEventError>) => void;
      const ready = new Promise<Result.Result<void, RecurringProcessingEventError>>((resolve) => {
        resolveReady = resolve;
      });
      const settleReady = (result: Result.Result<void, RecurringProcessingEventError>) => {
        if (!readySettled) {
          readySettled = true;
          resolveReady(result);
        }
      };
      const handleMessage = (event: Event) => onEvent((event as MessageEvent<string>).data);
      const handleOpen = () => {
        if (hasOpened || hadError) {
          onReconnect();
        }
        hasOpened = true;
        settleReady(Result.succeed(undefined));
      };
      const handleError = () => {
        const error = subscriptionFailure(new Error("EventSource connection failed"));
        hadError = true;
        if (!hasOpened) {
          settleReady(Result.fail(error));
        } else {
          onFailure?.(error);
        }
      };
      source.addEventListener("message", handleMessage);
      source.addEventListener("open", handleOpen);
      source.addEventListener("error", handleError);

      return {
        ready,
        close: () => {
          source.removeEventListener("message", handleMessage);
          source.removeEventListener("open", handleOpen);
          source.removeEventListener("error", handleError);
          source.close();
          settleReady(
            Result.fail(
              new RecurringProcessingEventError(
                "subscription_closed",
                "Recurring processing updates subscription closed.",
              ),
            ),
          );
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
    : {
        subscribe: () =>
          failedSubscription(
            new RecurringProcessingEventError("invalid_build_target", targetResult.error.message),
          ),
      };
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
