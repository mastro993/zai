import { describe, expect, it } from "vitest";

import { categorySchema } from "../model";

describe("categorySchema wire decode", () => {
  it("accepts and canonicalizes numeric hues", () => {
    const parsed = categorySchema.parse({
      id: "root",
      parentId: null,
      name: "Food",
      description: null,
      hue: 360,
      role: "spending",
      parent: null,
    });

    expect(parsed.hue).toBe(0);
  });

  it("coerces invalid wire hues to neutral instead of failing the payload", () => {
    const parsed = categorySchema.parse({
      id: "child",
      parentId: "root",
      name: "Groceries",
      description: null,
      hue: "orange",
      role: "spending",
      parent: {
        id: "root",
        parentId: null,
        name: "Food",
        description: null,
        hue: 20,
        role: "spending",
      },
    });

    expect(parsed.hue).toBeNull();
    expect(parsed.parent?.hue).toBe(20);
  });
});
