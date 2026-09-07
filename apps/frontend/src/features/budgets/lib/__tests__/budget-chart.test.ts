import { describe, expect, it } from "vitest";

import { createBudgetChartData } from "../budget-chart";
import { budgetSchema } from "../../types/budget";

const makeBudget = (cadence: "day" | "week" | "month" | "year") =>
  budgetSchema.parse({
    id: `budget-${cadence}`,
    name: `${cadence} budget`,
    revision: 1,
    paused: false,
    categoryIds: [],
    cadence,
    measurementMode: "spending",
    baseAllowance: 10000,
    rolloverMode: "off",
    warningPercentage: 80,
    currentPeriod: {
      start:
        cadence === "year"
          ? "2026-01-01T00:00:00"
          : cadence === "week"
            ? "2026-07-13T00:00:00"
            : cadence === "day"
              ? "2026-07-15T00:00:00"
              : "2026-07-01T00:00:00",
      end:
        cadence === "year"
          ? "2027-01-01T00:00:00"
          : cadence === "week"
            ? "2026-07-20T00:00:00"
            : cadence === "day"
              ? "2026-07-16T00:00:00"
              : "2026-08-01T00:00:00",
      baseAllowance: 10000,
      effectiveAllowance: 10000,
      netBudgetSpending: 2500,
      remainingAllowance: 7500,
      status: "onTrack",
      complete: true,
      currency: "EUR",
    },
  });

describe("createBudgetChartData", () => {
  const now = new Date("2026-07-15T12:00:00");

  it("uses month days for monthly budgets", () => {
    const chart = createBudgetChartData(makeBudget("month"), now);

    expect(chart.labels.map(({ label }) => label)).toEqual(["1", "8", "15", "22", "29"]);
    expect(chart.actualPath).toContain("M");
    expect(chart.projectionPath).toContain("L");
  });

  it("uses weekdays for daily and weekly budgets", () => {
    expect(createBudgetChartData(makeBudget("day"), now).labels).toHaveLength(7);
    expect(createBudgetChartData(makeBudget("week"), now).labels).toHaveLength(7);
  });

  it("uses month labels for yearly budgets and explains pace projection", () => {
    const chart = createBudgetChartData(makeBudget("year"), now);

    expect(chart.labels.map(({ label }) => label)).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
    expect(chart.summary).toContain("Pace-based projection");
  });
});
