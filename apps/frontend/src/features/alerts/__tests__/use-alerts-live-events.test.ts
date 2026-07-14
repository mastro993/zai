// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createTransportMock, warningMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
  warningMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { warning: warningMock },
}));
vi.mock("../commands/alert-events", () => ({
  createAlertEventTransport: createTransportMock,
}));

import { useAlertsLiveEvents } from "../hooks/use-alerts-live-events";

let emit: (value: unknown) => void = () => undefined;
let reconnect: () => void = () => undefined;

describe("useAlertsLiveEvents", () => {
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    close = vi.fn();
    warningMock.mockReset();
    createTransportMock.mockReset();
    createTransportMock.mockImplementation(() => ({
      subscribe: (onEvent: (value: unknown) => void, onReconnect: () => void) => {
        emit = onEvent;
        reconnect = onReconnect;
        return { ready: Promise.resolve(), close };
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reconciles valid, malformed, unknown, reconnect, focus, and visible events", async () => {
    const onReconcile = vi.fn();
    const onReady = vi.fn();
    const { unmount } = renderHook(() =>
      useAlertsLiveEvents({
        onOpenLedger: vi.fn(),
        onReconcile,
        onReady,
      }),
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    await act(async () => {
      emit(JSON.stringify({ version: 1, type: "stateChanged" }));
      emit("not json");
      emit(JSON.stringify({ version: 1, type: "unknown" }));
      reconnect();
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onReconcile).toHaveBeenCalledTimes(6);
    unmount();
    expect(close).toHaveBeenCalledOnce();
  });

  it("shows foreground warning alerts with an action that opens the ledger", async () => {
    const onOpenLedger = vi.fn();
    const { unmount } = renderHook(() =>
      useAlertsLiveEvents({
        onOpenLedger,
        onReconcile: vi.fn(),
        onReady: vi.fn(),
      }),
    );
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    await act(async () => {
      emit(
        JSON.stringify({
          version: 1,
          type: "created",
          alert: {
            id: "550e8400-e29b-41d4-a716-446655440000",
            producerKey: "budget.status",
            occurrenceKey: "period-1",
            severity: "warning",
            title: "Budget warning",
            body: "Budget body",
            destination: null,
            data: null,
            createdAt: "2026-07-14T12:00:00",
            readAt: null,
          },
        }),
      );
    });

    expect(warningMock).toHaveBeenCalledOnce();
    const [, options] = warningMock.mock.calls[0] as [string, { action: { onClick: () => void } }];
    options.action.onClick();
    expect(onOpenLedger).toHaveBeenCalledOnce();
    unmount();
  });
});
