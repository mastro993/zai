import { describe, expect, it } from "vitest";

import { budgetFormSchema } from "../budget";

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
      });
    }
  });

  it("rejects empty names and malformed allowances", () => {
    const result = budgetFormSchema.safeParse({ name: " ", baseAllowance: "10.999" });

    expect(result.success).toBe(false);
  });
});
