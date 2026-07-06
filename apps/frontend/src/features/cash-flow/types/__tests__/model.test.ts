import { describe, expect, it } from "vitest";

import { getCategoryDisplayColor } from "../../lib/category";
import { DEFAULT_CATEGORY_COLOR, categoryFormSchema } from "../model";

describe("cash-flow model", () => {
  it("uses parent color as the child category display color", () => {
    const color = getCategoryDisplayColor({
      id: "child",
      parentId: "parent",
      name: "Child",
      color: "#D31212",
      parent: {
        id: "parent",
        parentId: null,
        name: "Parent",
        color: "#1479C9",
      },
    });

    expect(color).toBe("#1479C9");
  });

  it("falls back when a category has no displayable color", () => {
    const color = getCategoryDisplayColor({
      id: "root",
      parentId: null,
      name: "Root",
      color: null,
      parent: null,
    });

    expect(color).toBe(DEFAULT_CATEGORY_COLOR);
  });

  it("rejects colors outside the frontend picker pool", () => {
    const result = categoryFormSchema.safeParse({
      name: "Food",
      color: "#FFFFFF",
    });

    expect(result.success).toBe(false);
  });
});
