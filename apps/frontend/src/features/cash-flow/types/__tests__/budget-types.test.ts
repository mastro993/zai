import { describe, expect, it } from "vitest";

import { budgetFormSchema } from "../budget-types";

describe("budgetFormSchema", () => {
  it("accepts zero allowance", () => {
    const result = budgetFormSchema.safeParse({
      name: "No spend",
      allowance: "0",
      cadence: "monthly",
      categoryIds: ["cat-1"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowance).toBe(0);
    }
  });

  it("rejects blank name", () => {
    const result = budgetFormSchema.safeParse({
      name: "   ",
      allowance: "10.00",
      cadence: "monthly",
      categoryIds: ["cat-1"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty category scope", () => {
    const result = budgetFormSchema.safeParse({
      name: "Food",
      allowance: "10.00",
      cadence: "monthly",
      categoryIds: [],
    });

    expect(result.success).toBe(false);
  });
});
