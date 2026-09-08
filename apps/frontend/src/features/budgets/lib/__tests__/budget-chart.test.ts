import { describe, expect, it } from "vitest";

import { createBudgetChartData } from "../budget-chart";
import { budgetSchema, type BudgetOverview } from "../../types/budget";

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

const makeOverview = (
  cadence: "day" | "week" | "month" | "year",
  spendingBuckets: BudgetOverview["spendingBuckets"],
): BudgetOverview => ({ ...makeBudget(cadence), spendingBuckets });

describe("createBudgetChartData", () => {
  it("uses real daily values for monthly budgets", () => {
    const chart = createBudgetChartData(
      makeOverview("month", [
        { start: "2026-07-01T00:00:00", value: 100, complete: true },
        { start: "2026-07-15T00:00:00", value: 300, complete: true },
      ]),
    );

    expect(chart.labels.map(({ label }) => label)).toEqual(["1", "8", "15", "22", "31"]);
    expect(chart.yAxisLabels).toHaveLength(4);
    expect(chart.yAxisLabels[0]?.label).toBe("€0.1k");
    expect(chart.yAxisLabels.at(-1)?.label).toBe("€0");
    expect(chart.actualPath).toMatch(/^M 0\.00 .* C /);
    expect(chart.actualAreaPath).toMatch(/Z$/);
    expect(chart.points[0]?.value).toBe(100);
    expect(chart.points[14]?.value).toBe(400);
  });

  it("uses the budget's one-day period for daily progress", () => {
    const chart = createBudgetChartData(makeOverview("day", []));

    expect(chart.labels.map(({ label }) => label)).toEqual(["12am", "6am", "12pm", "6pm", "12am"]);
    expect(chart.points).toHaveLength(24);
  });

  it("uses weekdays for weekly budgets", () => {
    expect(createBudgetChartData(makeOverview("week", [])).labels).toHaveLength(7);
  });

  it("uses real monthly values for yearly budgets without projecting future spending", () => {
    const chart = createBudgetChartData(
      makeOverview("year", [
        { start: "2026-01-01T00:00:00", value: 100, complete: true },
        { start: "2026-03-01T00:00:00", value: 300, complete: true },
      ]),
    );

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
    expect(chart.points.map(({ value }) => value)).toEqual([
      100, 100, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400,
    ]);
    expect(chart.summary).toContain("Jan €1.00");
    expect(chart.summary).toContain("Mar €4.00");
    expect(chart.summary).not.toContain("projected");
  });

  it("stops current-year charts at the current date", () => {
    const chart = createBudgetChartData(makeOverview("year", []), new Date("2026-09-08T00:00:00"));

    expect(chart.actualPath).not.toContain("320.00");
  });
});
