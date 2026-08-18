// @vitest-environment jsdom
import { Result } from "@praha/byethrow";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CurrencyStateEventError,
  type CurrencyStateEventHandler,
  type CurrencyStateEventReconnectHandler,
} from "../../commands/currency-state-events";
import * as currencyStateEvents from "../../commands/currency-state-events";
import {
  CurrencyStateReconciliationError,
  useCurrencyStateLiveEvents,
} from "../use-currency-state-live-events";

let emit: CurrencyStateEventHandler = () => undefined;
let reconnect: CurrencyStateEventReconnectHandler = () => undefined;
let readyResult: Result.Result<void, CurrencyStateEventError> = Result.succeed(undefined);
let readyPromiseFactory = () => Promise.resolve(readyResult);

describe("useCurrencyStateLiveEvents", () => {
  let close: () => void;

  beforeEach(() => {
    close = vi.fn(() => undefined);
    readyResult = Result.succeed(undefined);
    readyPromiseFactory = () => Promise.resolve(readyResult);
    vi.spyOn(currencyStateEvents, "createCurrencyStateEventTransport").mockImplementation(() => ({
      subscribe: (onEvent, onReconnect) => {
        emit = onEvent;
        reconnect = onReconnect;
        return {
          ready: readyPromiseFactory(),
          close: () => {
            close();
          },
        };
      },
    }));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET-reconciles on ready, lag, reconnect, focus, and visibility", async () => {
    const onReconcile = vi.fn(() => Promise.resolve(Result.succeed(undefined)));
    const onReady = vi.fn(() => Promise.resolve(Result.succeed(undefined)));
    const { unmount } = renderHook(() =>
      useCurrencyStateLiveEvents({
        onReconcile,
        onReady,
      }),
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(onReconcile).toHaveBeenCalledOnce();

    await act(async () => {
      emit(JSON.stringify({ version: 1, type: "stateChanged" }));
      emit("not json");
      emit(JSON.stringify({ version: 99, type: "stateChanged" }));
      reconnect();
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onReconcile).toHaveBeenCalledTimes(3);
    unmount();
    expect(close).toHaveBeenCalledOnce();
  });

  it("surfaces typed subscription failure and still reconciles", async () => {
    const onReconcile = vi.fn(() => Promise.resolve(Result.succeed(undefined)));
    const onReady = vi.fn(() => Promise.resolve(Result.succeed(undefined)));
    const onSubscriptionFailure = vi.fn();
    readyResult = Result.fail(
      new CurrencyStateEventError("subscription_failed", "subscription unavailable"),
    );

    renderHook(() =>
      useCurrencyStateLiveEvents({
        onReconcile,
        onReady,
        onSubscriptionFailure,
      }),
    );

    await waitFor(() => expect(onSubscriptionFailure).toHaveBeenCalledOnce());
    expect(onReady).not.toHaveBeenCalled();
    expect(onReconcile).toHaveBeenCalled();
    void CurrencyStateReconciliationError;
  });
});
