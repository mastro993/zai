import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";

import type { CommandError } from "@/commands/errors";

import {
  buildCreateCategoryRequest,
  buildDeleteCategoriesRequest,
  buildGetCategoriesRequest,
  buildGetCategoryRequest,
  buildImportCategoriesRequest,
  buildPreviewDeleteCategoriesRequest,
  buildUpdateCategoryRequest,
} from "../web-requests";

const unwrap = <T>(result: Result.Result<T, CommandError>): T | undefined => {
  expect(Result.isSuccess(result)).toBe(true);
  return Result.isSuccess(result) ? result.value : undefined;
};

describe("category web requests", () => {
  it("maps category reads", () => {
    expect(unwrap(buildGetCategoriesRequest({ parentId: null }))).toEqual({
      method: "GET",
      path: "/categories",
      query: undefined,
    });
    expect(unwrap(buildGetCategoriesRequest({ parentId: "parent-1" }))).toEqual({
      method: "GET",
      path: "/categories",
      query: { parentId: "parent-1" },
    });
    expect(unwrap(buildGetCategoryRequest({ categoryId: "category-1" }))).toEqual({
      method: "GET",
      path: "/categories/category-1",
    });
  });

  it("maps creation and removes ids from updates", () => {
    const newCategory = { name: "Food", parentId: null, description: null, hue: 20 };
    expect(unwrap(buildCreateCategoryRequest({ newCategory }))).toEqual({
      method: "POST",
      path: "/categories",
      body: newCategory,
    });
    expect(
      unwrap(
        buildUpdateCategoryRequest({
          updatedCategory: { ...newCategory, id: "category-1", confirmBudgetImpact: true },
        }),
      ),
    ).toEqual({
      method: "PUT",
      path: "/categories/category-1",
      body: { ...newCategory, confirmBudgetImpact: true },
    });
  });

  it("maps deletion previews, bulk options, and imports", () => {
    expect(
      unwrap(
        buildDeleteCategoriesRequest({
          categoryIds: ["category-1"],
          childrenStrategy: "block",
          confirmBudgetImpact: true,
        }),
      ),
    ).toEqual({
      method: "POST",
      path: "/categories/bulk-delete",
      body: { categoryIds: ["category-1"], childrenStrategy: "block", confirmBudgetImpact: true },
    });
    expect(unwrap(buildPreviewDeleteCategoriesRequest({ categoryIds: ["category-1"] }))).toEqual({
      method: "POST",
      path: "/categories/bulk-delete/preview",
      body: { categoryIds: ["category-1"] },
    });
    const categories = [{ name: "Food", hue: 20 }];
    expect(unwrap(buildImportCategoriesRequest({ categories }))).toEqual({
      method: "POST",
      path: "/categories/import",
      body: { categories },
    });
  });

  it("rejects malformed ids and arrays locally", () => {
    expect(Result.isFailure(buildGetCategoryRequest({ categoryId: "" }))).toBe(true);
    expect(Result.isFailure(buildDeleteCategoriesRequest({ categoryIds: [] }))).toBe(true);
  });
});
