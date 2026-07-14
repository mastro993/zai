// @vitest-environment jsdom
import fixtures from "../../../../../../test-fixtures/domain-alert-events.json";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createTransportMock, showUrgentAlertToastMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
  showUrgentAlertToastMock: vi.fn(),
}));

import type * as UrgentAlertToastModule from "../lib/urgent-alert-toast";

vi.mock("../lib/urgent-alert-toast", async () => {
  const actual = await vi.importActual<UrgentAlertToastModule>("../lib/urgent-alert-toast");
  return {
    ...actual,
    showUrgentAlertToast: showUrgentAlertToastMock,
  };
});
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
    showUrgentAlertToastMock.mockReset();
    createTransportMock.mockReset();
    createTransportMock.mockImplementation(() => ({
      subscribe: (onEvent: (value: unknown) => void, onReconnect: () => void) => {
        emit = onEvent;
        reconnect = onReconnect;
        return { ready: Promise.resolve(), close };
      },
    }));
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reconciles valid, malformed, unknown, reconnect, focus, and visible events without toasts", async () => {
    const onReconcile = vi.fn();
    const onReady = vi.fn();
    const { unmount } = renderHook(() =>
      useAlertsLiveEvents({
        onActivateAlert: vi.fn(),
        onReconcile,
        onReady,
      }),
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());

    await act(async () => {
      emit(JSON.stringify(fixtures[3]));
      emit("not json");
      emit(JSON.stringify({ version: 1, type: "unknown" }));
      reconnect();
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onReconcile).toHaveBeenCalledTimes(6);
    expect(showUrgentAlertToastMock).not.toHaveBeenCalled();
    unmount();
    expect(close).toHaveBeenCalledOnce();
  });

  it("shows urgent toasts only for live foreground warning and critical created events", async () => {
    const onActivateAlert = vi.fn();
    renderHook(() =>
      useAlertsLiveEvents({
        onActivateAlert,
        onReconcile: vi.fn(),
        onReady: vi.fn(),
      }),
    );

    await act(async () => {
      emit(JSON.stringify(fixtures[1]));
      emit(JSON.stringify(fixtures[0]));
      emit(JSON.stringify(fixtures[2]));
    });

    expect(showUrgentAlertToastMock).toHaveBeenCalledTimes(2);
    const [, activateHandler] = showUrgentAlertToastMock.mock.calls[0] as [
      unknown,
      (alert: { id: string }) => void,
    ];
    activateHandler({ id: "550e8400-e29b-41d4-a716-446655440000" } as never);
    expect(onActivateAlert).toHaveBeenCalledWith({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("suppresses urgent toasts when the document is hidden or unfocused", async () => {
    renderHook(() =>
      useAlertsLiveEvents({
        onActivateAlert: vi.fn(),
        onReconcile: vi.fn(),
        onReady: vi.fn(),
      }),
    );

    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    await act(async () => {
      emit(JSON.stringify(fixtures[0]));
    });
    expect(showUrgentAlertToastMock).not.toHaveBeenCalled();

    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      emit(JSON.stringify(fixtures[2]));
    });
    expect(showUrgentAlertToastMock).not.toHaveBeenCalled();
  });
});
