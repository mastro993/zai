import { describe, expect, it } from "vitest";

import { categoryFormSchema, transactionFormSchema } from "../model";

describe("transactionFormSchema", () => {
  it("accepts zero amounts", () => {
    for (const amount of ["0", "0.00", ".00"]) {
      const result = transactionFormSchema.safeParse({
        description: "",
        amount,
        transactionDate: "2026-07-09T12:00",
        transactionType: "expense",
        transactionCategoryId: "",
        notes: "",
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.amount).toBe(0);
      }
    }
  });

  it("enforces the backend minor-unit boundary", () => {
    const input = {
      description: "",
      transactionDate: "2026-07-09T12:00",
      transactionType: "expense",
      transactionCategoryId: "",
      notes: "",
    };

    expect(transactionFormSchema.safeParse({ ...input, amount: "21474836.47" }).success).toBe(true);
    expect(transactionFormSchema.safeParse({ ...input, amount: "21474836.48" }).success).toBe(
      false,
    );
  });
});

describe("categoryFormSchema", () => {
  it("requires a role for root categories", () => {
    const result = categoryFormSchema.safeParse({
      name: "Salary",
      parentId: "",
      color: "#951818",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an independent role for child categories", () => {
    const result = categoryFormSchema.safeParse({
      name: "Bonus",
      parentId: "salary",
      role: "income",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a root role and an inherited child without a role", () => {
    expect(
      categoryFormSchema.safeParse({
        name: "Salary",
        parentId: "",
        role: "income",
      }).success,
    ).toBe(true);
    expect(
      categoryFormSchema.safeParse({
        name: "Bonus",
        parentId: "salary",
      }).success,
    ).toBe(true);
  });
});
