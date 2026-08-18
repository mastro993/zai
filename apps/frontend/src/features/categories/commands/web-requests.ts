import { Result } from "@praha/byethrow";

import { CommandError } from "@/commands/errors";
import type { WebRequestSpec } from "@/commands/web-request-spec";

import type { CategoryBackendImportPayload } from "../lib/category-import";
import type { CategoryChildrenDeleteStrategy, CategoryRole } from "../types/model";

export interface GetCategoriesArgs {
  parentId?: string | null;
}

export interface CategoryIdentifierArgs {
  categoryId: string;
}

export interface CategoryPayload {
  id?: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  role?: CategoryRole | null;
  confirmBudgetImpact?: boolean;
}

export interface CreateCategoryArgs {
  newCategory: CategoryPayload;
}

export interface UpdateCategoryArgs {
  updatedCategory: CategoryPayload & { id: string };
}

export interface DeleteCategoriesArgs {
  categoryIds: Array<string>;
  childrenStrategy?: CategoryChildrenDeleteStrategy;
  confirmBudgetImpact?: boolean;
}

export interface PreviewDeleteCategoriesArgs {
  categoryIds: Array<string>;
  childrenStrategy?: CategoryChildrenDeleteStrategy;
}

export interface ImportCategoriesArgs {
  categories: Array<CategoryBackendImportPayload>;
}

interface CategoryDeleteBody {
  categoryIds: Array<string>;
  childrenStrategy?: CategoryChildrenDeleteStrategy;
  confirmBudgetImpact?: boolean;
}

const isNonEmptyString = (value: string): boolean => value.length > 0;

const validCategoryIds = (value: Array<string>): boolean =>
  value.length > 0 && value.every(isNonEmptyString);

const buildDeleteBody = (
  categoryIds: Array<string>,
  childrenStrategy?: CategoryChildrenDeleteStrategy,
  confirmBudgetImpact?: boolean,
): CategoryDeleteBody => {
  const body: CategoryDeleteBody = { categoryIds };
  if (childrenStrategy) {
    body.childrenStrategy = childrenStrategy;
  }
  if (confirmBudgetImpact) {
    body.confirmBudgetImpact = true;
  }
  return body;
};

export const buildGetCategoriesRequest = (
  args: GetCategoriesArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (args.parentId !== undefined && args.parentId !== null && !isNonEmptyString(args.parentId)) {
    return Result.fail(new CommandError("Category parent id must be a string or null"));
  }
  return Result.succeed({
    method: "GET",
    path: "/categories",
    query: args.parentId ? { parentId: args.parentId } : undefined,
  });
};

export const buildGetCategoryRequest = (
  args: CategoryIdentifierArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.categoryId)) {
    return Result.fail(new CommandError("Category id must be a non-empty string"));
  }
  return Result.succeed({
    method: "GET",
    path: `/categories/${args.categoryId}`,
  });
};

export const buildCreateCategoryRequest = (
  args: CreateCategoryArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.newCategory.name)) {
    return Result.fail(new CommandError("Category payload must be a valid record"));
  }
  return Result.succeed({
    method: "POST",
    path: "/categories",
    body: args.newCategory,
  });
};

export const buildUpdateCategoryRequest = (
  args: UpdateCategoryArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.updatedCategory.name) || !isNonEmptyString(args.updatedCategory.id)) {
    return Result.fail(new CommandError("Category update requires a valid id and payload"));
  }
  const { id: _id, ...body } = args.updatedCategory;
  return Result.succeed({
    method: "PUT",
    path: `/categories/${args.updatedCategory.id}`,
    body,
  });
};

export const buildDeleteCategoriesRequest = (
  args: DeleteCategoriesArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!validCategoryIds(args.categoryIds)) {
    return Result.fail(new CommandError("Category deletion requires valid ids and strategy"));
  }
  return Result.succeed({
    method: "POST",
    path: "/categories/bulk-delete",
    body: buildDeleteBody(args.categoryIds, args.childrenStrategy, args.confirmBudgetImpact),
  });
};

export const buildPreviewDeleteCategoriesRequest = (
  args: PreviewDeleteCategoriesArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!validCategoryIds(args.categoryIds)) {
    return Result.fail(new CommandError("Category preview requires valid ids and strategy"));
  }
  return Result.succeed({
    method: "POST",
    path: "/categories/bulk-delete/preview",
    body: buildDeleteBody(args.categoryIds, args.childrenStrategy),
  });
};

export const buildImportCategoriesRequest = (
  args: ImportCategoriesArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({
    method: "POST",
    path: "/categories/import",
    body: { categories: args.categories },
  });
