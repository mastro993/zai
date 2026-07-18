import { describe, expect, it } from "vitest";

import { categoryFormSchema } from "../model";

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
