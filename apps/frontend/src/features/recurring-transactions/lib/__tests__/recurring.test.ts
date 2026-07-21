import { describe, expect, it } from "vitest";

import { formatLocalDateTime, formatScheduleRule, progressRatio } from "../recurring";

describe("recurring helpers", () => {
  it("formats floating local datetimes without UTC shift", () => {
    expect(formatLocalDateTime("2026-08-01T09:00:00")).toMatch(/2026|Aug|01|9/);
  });

  it("describes schedule rules and finite progress", () => {
    expect(formatScheduleRule({ type: "interval", every: 2, unit: "week" })).toBe("Every 2 weeks");
    expect(formatScheduleRule({ type: "monthlyDay", day: 31 })).toBe("Monthly on day 31");
    expect(progressRatio(3, 12)).toBeCloseTo(0.25);
    expect(progressRatio(3, null)).toBeUndefined();
  });
});
