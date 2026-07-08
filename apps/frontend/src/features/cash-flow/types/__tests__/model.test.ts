import { describe, expect, it } from "vitest";

import { getCategoryDisplayColor, getCategoryDisplayName } from "../../lib/category";
import {
  CATEGORY_COLORS,
  CATEGORY_LIGHT_COLORS,
  DEFAULT_CATEGORY_COLOR,
  categoryFormSchema,
} from "../model";

describe("cash-flow model", () => {
  it("exposes a single palette of unique, valid hex colors", () => {
    expect(CATEGORY_COLORS.length).toBeGreaterThan(0);
    for (const color of CATEGORY_COLORS) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(new Set(CATEGORY_COLORS).size).toBe(CATEGORY_COLORS.length);
  });

  it("defaults to the first palette color", () => {
    expect(DEFAULT_CATEGORY_COLOR).toBe(CATEGORY_COLORS[0]);
  });

  it("accepts dark and light palette colors", () => {
    const saturated = categoryFormSchema.safeParse({
      name: "Food",
      color: CATEGORY_COLORS[0],
    });
    const light = categoryFormSchema.safeParse({
      name: "Food",
      color: CATEGORY_LIGHT_COLORS[0],
    });

    expect(saturated.success).toBe(true);
    expect(light.success).toBe(true);
  });
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

    const child = categoryById.get("child");
    if (!child) {
      throw new Error("expected child fixture");
    }

    const name = getCategoryDisplayName(child, categoryById);

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

  it("rejects invalid color strings", () => {
    const result = categoryFormSchema.safeParse({
      name: "Food",
      color: "not-a-color",
    });

    expect(result.success).toBe(false);
  });
});
