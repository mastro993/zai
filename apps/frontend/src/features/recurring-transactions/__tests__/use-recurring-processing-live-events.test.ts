// @vitest-environment jsdom
import { Result } from "@praha/byethrow";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createTransportMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
}));

vi.mock("../commands/recurring-processing-events", () => ({
  createRecurringProcessingEventTransport: createTransportMock,
}));

import {
  RecurringProcessingReconciliationError,
  useRecurringProcessingLiveEvents,
} from "../hooks/use-recurring-processing-live-events";

interface TestSubscriptionError {
  code: string;
  message: string;
}

let emit: (value: unknown) => void = () => undefined;
let reconnect: () => void = () => undefined;
let readyResult: Result.Result<void, TestSubscriptionError> = Result.succeed(undefined);
let readyPromiseFactory = () => Promise.resolve(readyResult);

describe("useRecurringProcessingLiveEvents", () => {
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    close = vi.fn();
    createTransportMock.mockReset();
    readyResult = Result.succeed(undefined);
    readyPromiseFactory = () => Promise.resolve(readyResult);
    createTransportMock.mockImplementation(() => ({
      subscribe: (onEvent: (value: unknown) => void, onReconnect: () => void) => {
        emit = onEvent;
        reconnect = onReconnect;
        return { ready: readyPromiseFactory(), close };
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

  it("reconciles ready, lag collapse, missed, malformed, unknown, reconnect, focus, and visible events", async () => {
    const onReconcile = vi.fn();
    onReconcile.mockImplementation(() => Promise.resolve(Result.succeed(undefined)));
    const onReady = vi.fn(() => Promise.resolve(Result.succeed(undefined)));
    const { unmount } = renderHook(() =>
      useRecurringProcessingLiveEvents({
        onReconcile,
        onReady,
      }),
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(onReconcile).toHaveBeenCalledOnce();

    await act(async () => {
      // Lag collapse / delay recovery arrive as stateChanged hints.
      emit(JSON.stringify({ version: 1, type: "stateChanged" }));
      // Missed mid-run progress still forces durable reconcile.
      emit(
        JSON.stringify({
          version: 1,
          type: "progress",
          runId: "run-1",
          committed: 2,
          alreadyFulfilled: 0,
          moreDueRemaining: true,
        }),
      );
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

  it("reconciles after failed readiness and surfaces typed subscription failure", async () => {
    const onReconcile = vi.fn(() => Promise.resolve(Result.succeed(undefined)));
    const onReady = vi.fn(() => Promise.resolve(Result.succeed(undefined)));
    const onSubscriptionFailure = vi.fn();
    readyResult = Result.fail({ code: "subscription_failed", message: "subscription unavailable" });

    renderHook(() =>
      useRecurringProcessingLiveEvents({
        onReconcile,
        onReady,
        onSubscriptionFailure,
      }),
    );

    await waitFor(() => expect(onSubscriptionFailure).toHaveBeenCalledOnce());
    expect(onReady).not.toHaveBeenCalled();
    expect(onReconcile).toHaveBeenCalledTimes(2);
  });

  it("reconciles on remount before subscription readiness", async () => {
    let resolveReady: ((result: Result.Result<void, TestSubscriptionError>) => void) | undefined;
    readyPromiseFactory = () =>
      new Promise<Result.Result<void, TestSubscriptionError>>((resolve) => {
        resolveReady = resolve;
      });
    const onReconcile = vi.fn(() => Promise.resolve(Result.succeed(undefined)));
    const onReady = vi.fn(() => Promise.resolve(Result.succeed(undefined)));

    renderHook(() => useRecurringProcessingLiveEvents({ onReconcile, onReady }));

    await waitFor(() => expect(onReconcile).toHaveBeenCalledOnce());
    expect(onReady).not.toHaveBeenCalled();
    resolveReady?.(Result.succeed(undefined));
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
  });

  it("reports reconciliation failure without creating an unhandled rejection", async () => {
    const error = new RecurringProcessingReconciliationError("durable read failed");
    const onReconcile = vi.fn(() => Promise.resolve(Result.fail(error)));
    const onReady = vi.fn(() => Promise.resolve(Result.succeed(undefined)));
    const onReconciliationFailure = vi.fn();

    renderHook(() =>
      useRecurringProcessingLiveEvents({
        onReconcile,
        onReady,
        onReconciliationFailure,
      }),
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    await act(async () => {
      emit(JSON.stringify({ version: 1, type: "stateChanged" }));
    });
    await waitFor(() => expect(onReconciliationFailure).toHaveBeenCalledWith(error));
  });
});
