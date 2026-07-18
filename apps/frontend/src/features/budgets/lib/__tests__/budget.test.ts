import { describe, expect, it } from "vitest";

import { budgetCadenceLabel, formatBudgetPeriod } from "../budget";

describe("budget display helpers", () => {
  it("formats the complete half-open current period", () => {
    expect(formatBudgetPeriod("2026-07-01T00:00:00", "2026-08-01T00:00:00")).toBe(
      "2026-07-01 to 2026-08-01",
    );
  });

  it("uses the full cadence label for current-period context", () => {
    expect(budgetCadenceLabel.week).toBe("Monday-based week");
  });
});
