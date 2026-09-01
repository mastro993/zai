import { describe, expect, it } from "vitest";

import {
  CATEGORY_ICON_CATALOG,
  CATEGORY_ICON_GROUPS,
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  categoryIconMatchesQuery,
  parseCategoryIcon,
  suggestCategoryIcons,
} from "../category-icon";
import { getCategoryDisplayIcon } from "../category";
import type { TransactionCategory } from "../../types/model";

const root = (overrides: Partial<TransactionCategory> = {}): TransactionCategory => ({
  id: "root",
  parentId: null,
  name: "Food",
  description: null,
  color: "#C32828",
  role: "spending",
  parent: null,
  ...overrides,
});

describe("category icons", () => {
  it("curates at least 160 unique keys across every group", () => {
    expect(CATEGORY_ICON_CATALOG.length).toBeGreaterThanOrEqual(160);
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICON_CATALOG.length);
    expect(CATEGORY_ICON_GROUPS).toEqual([
      "Food",
      "Lifestyle",
      "Home",
      "Health",
      "Travel",
      "Leisure",
      "Finance",
      "Pets",
      "Work",
      "Nature",
      "General",
    ]);
    for (const group of CATEGORY_ICON_GROUPS) {
      expect(CATEGORY_ICON_CATALOG.filter((entry) => entry.group === group).length).toBeGreaterThan(
        0,
      );
    }
  });

  it("filters catalog entries by label, key, or group", () => {
    const sushi = CATEGORY_ICON_CATALOG.find((entry) => entry.key === "sushi");
    expect(sushi).toBeDefined();
    if (!sushi) {
      return;
    }

    expect(categoryIconMatchesQuery(sushi, "")).toBe(true);
    expect(categoryIconMatchesQuery(sushi, "sushi")).toBe(true);
    expect(categoryIconMatchesQuery(sushi, "Food")).toBe(true);
    expect(categoryIconMatchesQuery(sushi, "pizza")).toBe(false);
  });

  it("suggests icons from name and description, and stays empty otherwise", () => {
    expect(suggestCategoryIcons("", "")).toEqual([]);
    expect(suggestCategoryIcons("   ", "")).toEqual([]);
    expect(suggestCategoryIcons("Xyzzy", "nope")).toEqual([]);

    const fromName = suggestCategoryIcons("Weekly sushi night", "");
    expect(fromName.map((entry) => entry.key)).toContain("sushi");

    const fromDescription = suggestCategoryIcons("Out", "parking near the metro");
    expect(fromDescription.map((entry) => entry.key)).toEqual(
      expect.arrayContaining(["parking", "metro"]),
    );
    expect(fromDescription.length).toBeLessThanOrEqual(8);
  });

  it("parses known keys and drops unknown values", () => {
    expect(parseCategoryIcon("food")).toBe("food");
    expect(parseCategoryIcon("spaceship")).toBeNull();
    expect(parseCategoryIcon("")).toBeNull();
  });

  it("uses default for a root without a selected icon", () => {
    expect(getCategoryDisplayIcon(root())).toBe(DEFAULT_CATEGORY_ICON);
  });

  it("lets a child inherit the root effective icon", () => {
    const parent = root({ icon: "dining" });
    const child: TransactionCategory = {
      id: "child",
      parentId: parent.id,
      name: "Groceries",
      description: null,
      color: null,
      role: "spending",
      parent,
    };

    expect(getCategoryDisplayIcon(child)).toBe("dining");
  });

  it("lets a child override the inherited icon, including the default symbol", () => {
    const parent = root({ icon: "dining" });
    const child: TransactionCategory = {
      id: "child",
      parentId: parent.id,
      name: "Groceries",
      description: null,
      color: null,
      icon: "default",
      role: "spending",
      parent,
    };

    expect(getCategoryDisplayIcon(child)).toBe("default");
  });
});
