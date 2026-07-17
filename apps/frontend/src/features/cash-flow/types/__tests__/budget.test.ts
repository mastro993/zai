import { describe, expect, it } from "vitest";

import { budgetFormSchema, budgetSchema } from "../budget";

describe("budgetFormSchema", () => {
  it("trims names and converts allowance to minor units", () => {
    const result = budgetFormSchema.safeParse({
      name: "  Monthly spending  ",
      baseAllowance: "100.01",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Monthly spending",
        baseAllowance: 10001,
        cadence: "month",
        categoryIds: [],
        measurementMode: "spending",
        rolloverMode: "off",
        warningPercentage: 80,
      });
    }
  });

  it("preserves selected cadence, scope, and measurement mode", () => {
    const result = budgetFormSchema.safeParse({
      name: "Weekly groceries",
      baseAllowance: "100.01",
      cadence: "week",
      categoryIds: ["groceries"],
      measurementMode: "netCashFlow",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Weekly groceries",
        baseAllowance: 10001,
        cadence: "week",
        categoryIds: ["groceries"],
        measurementMode: "netCashFlow",
        rolloverMode: "off",
        warningPercentage: 80,
      });
    }
  });

  it("accepts a custom whole warning percentage", () => {
    const result = budgetFormSchema.safeParse({
      name: "Custom warning",
      baseAllowance: "100",
      warningPercentage: "65",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warningPercentage).toBe(65);
    }
  });

  it("accepts disabled warnings", () => {
    const result = budgetFormSchema.safeParse({
      name: "Disabled warning",
      baseAllowance: "100",
      warningPercentage: "disabled",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warningPercentage).toBeNull();
    }
  });

  it("rejects empty names, malformed allowances, and invalid warning percentages", () => {
    const result = budgetFormSchema.safeParse({
      name: " ",
      baseAllowance: "10.999",
      warningPercentage: "101",
    });

    expect(result.success).toBe(false);
  });

  it("enforces the safe integer minor-unit boundary", () => {
    expect(
      budgetFormSchema.safeParse({
        name: "Maximum safe allowance",
        baseAllowance: "90071992547409.91",
      }).success,
    ).toBe(true);
    expect(
      budgetFormSchema.safeParse({
        name: "Unsafe allowance",
        baseAllowance: "90071992547409.92",
      }).success,
    ).toBe(false);
  });
});

describe("budgetSchema", () => {
  it("accepts paused lifecycle state", () => {
    const result = budgetSchema.safeParse({
      id: "budget-1",
      name: "Paused budget",
      revision: 1,
      paused: true,
      categoryIds: [],
      cadence: "month",
      measurementMode: "spending",
      baseAllowance: 10000,
      rolloverMode: "off",
      warningPercentage: 80,
      currentPeriod: {
        start: "2026-07-01T00:00:00",
        end: "2026-08-01T00:00:00",
        baseAllowance: 10000,
        effectiveAllowance: 10000,
        netBudgetSpending: 1000,
        remainingAllowance: 9000,
        status: "onTrack",
      },
    });

    expect(result.success).toBe(true);
  });
});
