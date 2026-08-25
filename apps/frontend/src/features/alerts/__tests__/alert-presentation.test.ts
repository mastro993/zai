import { describe, expect, it } from "vitest";
import {
  CalendarXIcon,
  ClockAlertIcon,
  DollarCircleIcon,
  Notification03Icon,
  RepeatIcon,
  Wallet03Icon,
} from "@hugeicons/core-free-icons";

import {
  ALERT_PRODUCER_KEYS,
  alertReadActionLabel,
  alertSeverityIconClass,
  alertTypeIcon,
} from "../lib/alert-presentation";

describe("alert presentation", () => {
  it("maps producer keys to domain icons", () => {
    expect(alertTypeIcon(ALERT_PRODUCER_KEYS.budgetStatus)).toBe(Wallet03Icon);
    expect(alertTypeIcon(ALERT_PRODUCER_KEYS.currencyRefreshFailure)).toBe(DollarCircleIcon);
    expect(alertTypeIcon(ALERT_PRODUCER_KEYS.recurringOccurrence)).toBe(RepeatIcon);
    expect(alertTypeIcon(ALERT_PRODUCER_KEYS.recurringGenerationFailure)).toBe(CalendarXIcon);
    expect(alertTypeIcon(ALERT_PRODUCER_KEYS.recurringProcessDelay)).toBe(ClockAlertIcon);
    expect(alertTypeIcon("unknown.producer")).toBe(Notification03Icon);
  });

  it("colors type icons by severity", () => {
    expect(alertSeverityIconClass("info")).toContain("text-primary");
    expect(alertSeverityIconClass("warning")).toContain("text-amber-600");
    expect(alertSeverityIconClass("critical")).toContain("text-destructive");
  });

  it("labels the read toggle by the action it performs", () => {
    expect(alertReadActionLabel(true)).toBe("Mark read");
    expect(alertReadActionLabel(false)).toBe("Mark unread");
  });
});
