import { describe, expect, it } from "vitest";

import type { TransactionCategory } from "@/features/categories/types/model";
import {
  DEFAULT_CATEGORY_FILTER_SELECTION,
  expandCategoryIdsForApi,
  formatCategoryFilterLabel,
  isActiveCategoryFilter,
  isChildIncludedByRollup,
  toggleChildSelection,
  toggleRootSelection,
  toggleUncategorized,
} from "../transaction-category-filter";

const categories: Array<TransactionCategory> = [
  { id: "food", name: "Food", parentId: null, color: "#43A047", role: "spending" },
  {
    id: "groceries",
    name: "Groceries",
    parentId: "food",
    color: null,
    role: "spending",
    parent: { id: "food", name: "Food", parentId: null, color: "#43A047", role: "spending" },
  },
  {
    id: "restaurants",
    name: "Restaurants",
    parentId: "food",
    color: null,
    role: "spending",
    parent: { id: "food", name: "Food", parentId: null, color: "#43A047", role: "spending" },
  },
  { id: "transport", name: "Transport", parentId: null, color: "#1E88E5", role: "spending" },
];

const childrenByParent = new Map([
  ["food", categories.filter((category) => category.parentId === "food")],
]);

describe("transaction category filter", () => {
  it("detects active selections", () => {
    expect(isActiveCategoryFilter(DEFAULT_CATEGORY_FILTER_SELECTION)).toBe(false);
    expect(
      isActiveCategoryFilter({
        categoryIds: ["food"],
        includeUncategorized: false,
      }),
    ).toBe(true);
    expect(
      isActiveCategoryFilter({
        categoryIds: [],
        includeUncategorized: true,
      }),
    ).toBe(true);
  });

  it("rolls root selection up to child ids for the api", () => {
    const selection = toggleRootSelection(
      DEFAULT_CATEGORY_FILTER_SELECTION,
      "food",
      childrenByParent.get("food") ?? [],
    );

    const expanded = expandCategoryIdsForApi(selection.categoryIds, categories);

    expect(new Set(expanded)).toEqual(new Set(["food", "groceries", "restaurants"]));
  });

  it("breaks rollup when a child is toggled off", () => {
    const rolledUp = toggleRootSelection(
      DEFAULT_CATEGORY_FILTER_SELECTION,
      "food",
      childrenByParent.get("food") ?? [],
    );

    const groceries = categories[1];
    if (!groceries) {
      throw new Error("expected groceries fixture");
    }

    const partial = toggleChildSelection(rolledUp, groceries, childrenByParent);

    expect(partial.categoryIds).toEqual(["restaurants"]);
    expect(isChildIncludedByRollup(partial, groceries)).toBe(false);
  });

  it("formats trigger labels", () => {
    expect(formatCategoryFilterLabel(DEFAULT_CATEGORY_FILTER_SELECTION, categories)).toBe(
      "All categories",
    );
    expect(
      formatCategoryFilterLabel(toggleUncategorized(DEFAULT_CATEGORY_FILTER_SELECTION), categories),
    ).toBe("Uncategorized");
    expect(
      formatCategoryFilterLabel(
        {
          categoryIds: ["food", "groceries", "restaurants"],
          includeUncategorized: false,
        },
        categories,
      ),
    ).toBe("Food");
    expect(
      formatCategoryFilterLabel(
        {
          categoryIds: ["groceries", "transport"],
          includeUncategorized: false,
        },
        categories,
      ),
    ).toBe("Transport +1");
  });

  it("keeps named categories and uncategorized mutually exclusive", () => {
    const withCategory = toggleRootSelection(
      { categoryIds: [], includeUncategorized: true },
      "food",
      childrenByParent.get("food") ?? [],
    );
    expect(withCategory.includeUncategorized).toBe(false);

    const withUncategorized = toggleUncategorized({
      categoryIds: ["food"],
      includeUncategorized: false,
    });
    expect(withUncategorized).toEqual({ categoryIds: [], includeUncategorized: true });
  });
});
