// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createTransportMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
}));

vi.mock("../commands/recurring-processing-events", () => ({
  createRecurringProcessingEventTransport: createTransportMock,
}));

import { useRecurringProcessingLiveEvents } from "../hooks/use-recurring-processing-live-events";

let emit: (value: unknown) => void = () => undefined;
let reconnect: () => void = () => undefined;

describe("useRecurringProcessingLiveEvents", () => {
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    close = vi.fn();
    createTransportMock.mockReset();
    createTransportMock.mockImplementation(() => ({
      subscribe: (onEvent: (value: unknown) => void, onReconnect: () => void) => {
        emit = onEvent;
        reconnect = onReconnect;
        return { ready: Promise.resolve(), close };
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
    const onReady = vi.fn(() => onReconcile());
    const { unmount } = renderHook(() =>
      useRecurringProcessingLiveEvents({
        onReconcile,
        onReady,
      }),
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(onReconcile).toHaveBeenCalledTimes(1);

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

    expect(onReconcile).toHaveBeenCalledTimes(8);
    unmount();
    expect(close).toHaveBeenCalledOnce();
  });
});
