// @vitest-environment jsdom
import fixtures from "../../../../../../test-fixtures/domain-alert-events.json";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AlertEventHandler, AlertEventReconnectHandler } from "../commands/alert-events";
import * as alertEvents from "../commands/alert-events";
import { useAlertsLiveEvents } from "../hooks/use-alerts-live-events";
import { parseDomainAlertEvent } from "../lib/parse";
import * as urgentToast from "../lib/urgent-alert-toast";

let emit: AlertEventHandler = () => undefined;
let reconnect: AlertEventReconnectHandler = () => undefined;

describe("useAlertsLiveEvents", () => {
  let close: () => void;

  beforeEach(() => {
    close = vi.fn(() => undefined);
    vi.spyOn(urgentToast, "showUrgentAlertToast").mockImplementation(() => undefined);
    vi.spyOn(alertEvents, "createAlertEventTransport").mockImplementation(() => ({
      subscribe: (onEvent, onReconnect) => {
        emit = onEvent;
        reconnect = onReconnect;
        return {
          ready: Promise.resolve(),
          close: () => {
            close();
          },
        };
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
    expect(urgentToast.showUrgentAlertToast).not.toHaveBeenCalled();
    unmount();
    expect(close).toHaveBeenCalledOnce();
  });

  it("shows urgent toasts only for live foreground warning and critical created events", async () => {
    const onActivateAlert = vi.fn();
    const warningEvent = parseDomainAlertEvent(fixtures[0]);
    if (warningEvent?.type !== "created") {
      throw new Error("Expected warning created fixture.");
    }

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

    expect(urgentToast.showUrgentAlertToast).toHaveBeenCalledTimes(2);
    const firstCall = vi.mocked(urgentToast.showUrgentAlertToast).mock.calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall === undefined) {
      return;
    }
    firstCall[1](warningEvent.alert);
    expect(onActivateAlert).toHaveBeenCalledWith(warningEvent.alert);
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
    expect(urgentToast.showUrgentAlertToast).not.toHaveBeenCalled();

    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      emit(JSON.stringify(fixtures[2]));
    });
    expect(urgentToast.showUrgentAlertToast).not.toHaveBeenCalled();
  });
});
