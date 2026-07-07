import { describe, expect, it } from "vitest";

import { getCategoryDisplayColor, getCategoryDisplayName } from "../../lib/category";
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

  it("shows root category name only", () => {
    const name = getCategoryDisplayName({
      id: "root",
      parentId: null,
      name: "Food",
    });

    expect(name).toBe("Food");
  });

  it("shows parent and child names for child categories", () => {
    const name = getCategoryDisplayName({
      id: "child",
      parentId: "parent",
      name: "Groceries",
      parent: {
        id: "parent",
        parentId: null,
        name: "Food",
      },
    });

    expect(name).toBe("Food / Groceries");
  });

  it("resolves parent name from categoryById when parent is missing", () => {
    const categoryById = new Map([
      [
        "parent",
        {
          id: "parent",
          parentId: null,
          name: "Food",
        },
      ],
      [
        "child",
        {
          id: "child",
          parentId: "parent",
          name: "Groceries",
        },
      ],
    ] as const);

    const name = getCategoryDisplayName(categoryById.get("child")!, categoryById);

    expect(name).toBe("Food / Groceries");
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
