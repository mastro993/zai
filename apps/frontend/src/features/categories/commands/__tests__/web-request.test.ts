import { describe, expect, it } from "vitest";

import { buildCategoryCommandRequestSpec } from "../web-command-map";

describe("category web requests", () => {
  it("maps category reads with and without a parent filter", () => {
    expect(
      buildCategoryCommandRequestSpec("get_transaction_categories", { parentId: null }),
    ).toEqual({
      method: "GET",
      path: "/categories",
      query: undefined,
    });
    expect(
      buildCategoryCommandRequestSpec("get_transaction_categories", { parentId: "parent-1" }),
    ).toEqual({
      method: "GET",
      path: "/categories",
      query: { parentId: "parent-1" },
    });
    expect(
      buildCategoryCommandRequestSpec("get_transaction_category", {
        categoryId: "category-1",
      }),
    ).toEqual({
      method: "GET",
      path: "/categories/category-1",
    });
  });

  it("maps category creation without changing the payload", () => {
    const newCategory = {
      name: "Food",
      parentId: null,
      description: null,
      color: "#ff0000",
    };

    expect(buildCategoryCommandRequestSpec("create_transaction_category", { newCategory })).toEqual(
      {
        method: "POST",
        path: "/categories",
        body: newCategory,
      },
    );
  });

  it("removes the category id from update bodies", () => {
    expect(
      buildCategoryCommandRequestSpec("update_transaction_category", {
        updatedCategory: {
          id: "category-1",
          name: "Dining",
          parentId: null,
          description: "Restaurants",
          color: "#123456",
          confirmBudgetImpact: true,
        },
      }),
    ).toEqual({
      method: "PUT",
      path: "/categories/category-1",
      body: {
        name: "Dining",
        parentId: null,
        description: "Restaurants",
        color: "#123456",
        confirmBudgetImpact: true,
      },
    });
  });

  it("maps bulk deletion and its optional confirmation", () => {
    expect(
      buildCategoryCommandRequestSpec("delete_transaction_categories", {
        categoryIds: ["category-1", "category-2"],
        childrenStrategy: "promote",
      }),
    ).toEqual({
      method: "POST",
      path: "/categories/bulk-delete",
      body: {
        categoryIds: ["category-1", "category-2"],
        childrenStrategy: "promote",
      },
    });
    expect(
      buildCategoryCommandRequestSpec("delete_transaction_categories", {
        categoryIds: ["category-1"],
        childrenStrategy: "block",
        confirmBudgetImpact: true,
      }),
    ).toEqual({
      method: "POST",
      path: "/categories/bulk-delete",
      body: {
        categoryIds: ["category-1"],
        childrenStrategy: "block",
        confirmBudgetImpact: true,
      },
    });
  });

  it("maps deletion previews and imports", () => {
    expect(
      buildCategoryCommandRequestSpec("preview_delete_transaction_categories", {
        categoryIds: ["category-1"],
        childrenStrategy: "block",
      }),
    ).toEqual({
      method: "POST",
      path: "/categories/bulk-delete/preview",
      body: {
        categoryIds: ["category-1"],
        childrenStrategy: "block",
      },
    });

    const categories = [{ name: "Food", color: "#ff0000" }];
    expect(
      buildCategoryCommandRequestSpec("import_transaction_categories", { categories }),
    ).toEqual({
      method: "POST",
      path: "/categories/import",
      body: { categories },
    });
  });
});
