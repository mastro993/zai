import { describe, expect, it } from "vitest";

import type { BudgetPeriodForecast, BudgetProjectionResult } from "../../types/budget-projection";
import {
  buildForecastMatrix,
  formatForecastPeriodLabel,
  formatProjectionSourceErrorKind,
} from "../forecast-matrix";

const period = (
  overrides: Partial<BudgetPeriodForecast> &
    Pick<BudgetPeriodForecast, "budgetId" | "budgetName" | "periodStart" | "periodEnd">,
): BudgetPeriodForecast => ({
  cadence: "month",
  measurementMode: "spending",
  rolloverMode: "off",
  baseAllowance: 100_000,
  actualNetBudgetSpending: 10_000,
  projectedDelta: 5_000,
  forecastNetBudgetSpending: 15_000,
  remainingAllowance: 85_000,
  status: "onTrack",
  partial: false,
  coveredUntil: overrides.periodEnd,
  attribution: [],
  ...overrides,
});

describe("buildForecastMatrix", () => {
  it("groups periods into budget rows with shared period columns", () => {
    const result: BudgetProjectionResult = {
      observedLocal: "2026-07-22T10:00:00",
      throughLocal: "2027-01-22T10:00:00",
      horizonMonths: 6,
      complete: true,
      sourceErrors: [],
      periods: [
        period({
          budgetId: "b-housing",
          budgetName: "Housing",
          periodStart: "2026-08-01T00:00:00",
          periodEnd: "2026-09-01T00:00:00",
        }),
        period({
          budgetId: "b-food",
          budgetName: "Food",
          periodStart: "2026-08-01T00:00:00",
          periodEnd: "2026-09-01T00:00:00",
          actualNetBudgetSpending: 2_000,
        }),
        period({
          budgetId: "b-housing",
          budgetName: "Housing",
          periodStart: "2026-09-01T00:00:00",
          periodEnd: "2026-10-01T00:00:00",
          projectedDelta: 8_000,
        }),
      ],
    };

    const matrix = buildForecastMatrix(result);

    expect(matrix.columns.map((column) => column.periodStart)).toEqual([
      "2026-08-01T00:00:00",
      "2026-09-01T00:00:00",
    ]);
    expect(matrix.rows.map((row) => row.budgetName)).toEqual(["Food", "Housing"]);
    expect(matrix.rows[1]?.cells[0]?.projectedDelta).toBe(5_000);
    expect(matrix.rows[1]?.cells[1]?.projectedDelta).toBe(8_000);
    expect(matrix.rows[0]?.cells[1]).toBeUndefined();
  });

  it("returns empty matrix when projection has no periods", () => {
    expect(
      buildForecastMatrix({
        observedLocal: "2026-07-22T10:00:00",
        throughLocal: "2027-01-22T10:00:00",
        horizonMonths: 3,
        complete: true,
        periods: [],
        sourceErrors: [],
      }),
    ).toEqual({ columns: [], rows: [] });
  });
});

describe("formatForecastPeriodLabel", () => {
  it("uses date range for period headers", () => {
    expect(formatForecastPeriodLabel("2026-08-01T00:00:00", "2026-09-01T00:00:00")).toBe(
      "2026-08-01 to 2026-09-01",
    );
  });
});

describe("formatProjectionSourceErrorKind", () => {
  it("maps typed source errors to plain labels", () => {
    expect(formatProjectionSourceErrorKind("dueCatchUp")).toBe("Catch-up due");
    expect(formatProjectionSourceErrorKind("generationBlocked")).toBe("Generation blocked");
    expect(formatProjectionSourceErrorKind("staleBudgetTimeline")).toBe("Stale budget timeline");
    expect(formatProjectionSourceErrorKind("missingRevision")).toBe("Missing revision");
  });
});
