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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const validCategoryIds = (value: unknown): value is Array<string> =>
  Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);

const validStrategy = (value: unknown): value is CategoryChildrenDeleteStrategy =>
  value === undefined || value === "block" || value === "promote" || value === "delete";

export const buildGetCategoriesRequest = (
  args: GetCategoriesArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (
    !isRecord(args) ||
    (args.parentId !== undefined && args.parentId !== null && !isNonEmptyString(args.parentId))
  ) {
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
  if (!isRecord(args) || !isNonEmptyString(args.categoryId)) {
    return Result.fail(new CommandError("Category id must be a non-empty string"));
  }
  return Result.succeed({
    method: "GET",
    path: `/categories/${args.categoryId}`,
  });
};

const validCategoryPayload = (value: unknown): value is CategoryPayload =>
  isRecord(value) &&
  isNonEmptyString(value.name) &&
  (value.color === undefined ||
    value.color === null ||
    (typeof value.color === "string" && /^#[0-9a-f]{6}$/i.test(value.color)));

export const buildCreateCategoryRequest = (
  args: CreateCategoryArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !validCategoryPayload(args.newCategory)) {
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
  if (
    !isRecord(args) ||
    !validCategoryPayload(args.updatedCategory) ||
    !isNonEmptyString(args.updatedCategory.id)
  ) {
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
  if (
    !isRecord(args) ||
    !validCategoryIds(args.categoryIds) ||
    !validStrategy(args.childrenStrategy)
  ) {
    return Result.fail(new CommandError("Category deletion requires valid ids and strategy"));
  }
  return Result.succeed({
    method: "POST",
    path: "/categories/bulk-delete",
    body: {
      categoryIds: args.categoryIds,
      ...(args.childrenStrategy ? { childrenStrategy: args.childrenStrategy } : {}),
      ...(args.confirmBudgetImpact ? { confirmBudgetImpact: true } : {}),
    },
  });
};

export const buildPreviewDeleteCategoriesRequest = (
  args: PreviewDeleteCategoriesArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (
    !isRecord(args) ||
    !validCategoryIds(args.categoryIds) ||
    !validStrategy(args.childrenStrategy)
  ) {
    return Result.fail(new CommandError("Category preview requires valid ids and strategy"));
  }
  return Result.succeed({
    method: "POST",
    path: "/categories/bulk-delete/preview",
    body: {
      categoryIds: args.categoryIds,
      ...(args.childrenStrategy ? { childrenStrategy: args.childrenStrategy } : {}),
    },
  });
};

export const buildImportCategoriesRequest = (
  args: ImportCategoriesArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !Array.isArray(args.categories)) {
    return Result.fail(new CommandError("Category import requires categories"));
  }
  return Result.succeed({
    method: "POST",
    path: "/categories/import",
    body: { categories: args.categories },
  });
};
