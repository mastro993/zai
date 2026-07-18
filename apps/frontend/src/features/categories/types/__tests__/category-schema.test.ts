import { describe, expect, it } from "vitest";

import { categorySchema } from "../model";

describe("categorySchema wire decode", () => {
  it("accepts valid hex colors", () => {
    const parsed = categorySchema.parse({
      id: "root",
      parentId: null,
      name: "Food",
      description: null,
      color: "#f6caca",
      role: "spending",
      parent: null,
    });

    expect(parsed.color).toBe("#F6CACA");
  });

  it("coerces legacy named colors to null instead of failing the whole payload", () => {
    const parsed = categorySchema.parse({
      id: "child",
      parentId: "root",
      name: "Groceries",
      description: null,
      color: "orange",
      role: "spending",
      parent: {
        id: "root",
        parentId: null,
        name: "Food",
        description: null,
        color: "#F6CACA",
        role: "spending",
      },
    });

    expect(parsed.color).toBeNull();
    expect(parsed.parent?.color).toBe("#F6CACA");
  });
});
