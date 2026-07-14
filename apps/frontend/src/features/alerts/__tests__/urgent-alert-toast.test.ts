import fixtures from "../../../../../../test-fixtures/domain-alert-events.json";
import { describe, expect, it, vi } from "vitest";

import { parseDomainAlertEvent } from "../lib/parse";
import {
  shouldShowUrgentAlertToast,
  showUrgentAlertToast,
  type UrgentAlertToastContext,
} from "../lib/urgent-alert-toast";

const foreground: UrgentAlertToastContext = {
  hasFocus: () => true,
  visibilityState: "visible",
};

const background: UrgentAlertToastContext = {
  hasFocus: () => false,
  visibilityState: "hidden",
};

describe("urgent alert toast policy", () => {
  it("accepts shared warning and critical created fixtures only in the foreground", () => {
    for (const fixture of fixtures) {
      const event = parseDomainAlertEvent(fixture);
      if (event?.type === "created" && event.alert.severity === "info") {
        expect(shouldShowUrgentAlertToast(event, foreground)).toBe(false);
        continue;
      }
      if (event?.type === "created") {
        expect(shouldShowUrgentAlertToast(event, foreground)).toBe(true);
        expect(shouldShowUrgentAlertToast(event, background)).toBe(false);
        continue;
      }
      expect(shouldShowUrgentAlertToast(event, foreground)).toBe(false);
    }
  });

  it("never toasts malformed, unknown, backlog, or reconciliation events", () => {
    for (const value of [
      null,
      "not-json",
      { version: 1, type: "stateChanged" },
      { version: 1, type: "unknown" },
      { version: 2, type: "stateChanged" },
    ]) {
      expect(shouldShowUrgentAlertToast(parseDomainAlertEvent(value), foreground)).toBe(false);
    }
  });

  it("shows warning and critical toasts with alert activation", () => {
    const warningMock = vi.fn();
    const errorMock = vi.fn();
    const onActivate = vi.fn();
    const warningEvent = parseDomainAlertEvent(fixtures[0]);
    const criticalEvent = parseDomainAlertEvent(fixtures[2]);

    if (warningEvent?.type !== "created" || criticalEvent?.type !== "created") {
      throw new Error("Expected warning and critical created fixtures.");
    }

    showUrgentAlertToast(warningEvent.alert, onActivate, {
      warning: warningMock,
      error: errorMock,
    });
    showUrgentAlertToast(criticalEvent.alert, onActivate, {
      warning: warningMock,
      error: errorMock,
    });

    expect(warningMock).toHaveBeenCalledOnce();
    expect(errorMock).toHaveBeenCalledOnce();
    const warningOptions = warningMock.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    warningOptions.action.onClick();
    expect(onActivate).toHaveBeenCalledWith(warningEvent.alert);
  });

  it("still toasts created alerts with stale destinations and skips invalid envelopes", () => {
    const errorMock = vi.fn();
    const criticalFixture = parseDomainAlertEvent(fixtures[2]);
    if (criticalFixture?.type !== "created") {
      throw new Error("Expected critical created fixture.");
    }

    expect(shouldShowUrgentAlertToast(criticalFixture, foreground)).toBe(true);
    showUrgentAlertToast(criticalFixture.alert, vi.fn(), {
      warning: vi.fn(),
      error: errorMock,
    });
    expect(errorMock).toHaveBeenCalledOnce();

    expect(
      shouldShowUrgentAlertToast(
        parseDomainAlertEvent({
          version: 1,
          type: "created",
          alert: { ...criticalFixture.alert, title: "" },
        }),
        foreground,
      ),
    ).toBe(false);
  });
});
