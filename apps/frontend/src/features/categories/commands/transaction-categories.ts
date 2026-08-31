import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";

import { toCategoryBackendImportPayload, type CategoryImportPayload } from "../lib/category-import";
import type {
  CategoryChildrenDeleteStrategy,
  CategoryDeletionPreview,
  CategoryFormValues,
  TransactionCategory,
} from "../types/model";
import { CATEGORY_COMMANDS } from "./registry";
import type { CategoryPayload, DeleteCategoriesArgs, UpdateCategoryArgs } from "./web-requests";

const toCategoryPayload = (values: CategoryFormValues): CategoryPayload => ({
  name: values.name,
  parentId: values.parentId || null,
  description: values.description || null,
  color: values.color ?? null,
  icon: values.icon ?? null,
  role: values.parentId ? null : (values.role ?? null),
});

export const getTransactionCategories = (
  parentId?: string,
): CommandResult<Array<TransactionCategory>> => {
  return invokeDecodedCommand(CATEGORY_COMMANDS.get_transaction_categories, {
    parentId: parentId ?? null,
  });
};

export const createTransactionCategory = (
  values: CategoryFormValues,
): CommandResult<TransactionCategory> => {
  return invokeDecodedCommand(CATEGORY_COMMANDS.create_transaction_category, {
    newCategory: toCategoryPayload(values),
  });
};

export const updateTransactionCategory = (
  id: string,
  values: CategoryFormValues,
  confirmBudgetImpact = false,
): CommandResult<TransactionCategory> => {
  const updatedCategory: UpdateCategoryArgs["updatedCategory"] = {
    id,
    ...toCategoryPayload(values),
  };
  if (confirmBudgetImpact) {
    updatedCategory.confirmBudgetImpact = true;
  }
  return invokeDecodedCommand(CATEGORY_COMMANDS.update_transaction_category, {
    updatedCategory,
  });
};

export const deleteTransactionCategories = (
  categoryIds: Array<string>,
  childrenStrategy: CategoryChildrenDeleteStrategy = "block",
  confirmBudgetImpact = false,
): CommandResult<Array<TransactionCategory>> => {
  const args: DeleteCategoriesArgs = {
    categoryIds,
    childrenStrategy,
  };
  if (confirmBudgetImpact) {
    args.confirmBudgetImpact = true;
  }
  return invokeDecodedCommand(CATEGORY_COMMANDS.delete_transaction_categories, args);
};

export const previewDeleteTransactionCategories = (
  categoryIds: Array<string>,
  childrenStrategy: CategoryChildrenDeleteStrategy = "block",
): CommandResult<CategoryDeletionPreview> => {
  return invokeDecodedCommand(CATEGORY_COMMANDS.preview_delete_transaction_categories, {
    categoryIds,
    childrenStrategy,
  });
};

export const importTransactionCategories = (
  categories: Array<CategoryImportPayload>,
): CommandResult<Array<TransactionCategory>> => {
  return invokeDecodedCommand(CATEGORY_COMMANDS.import_transaction_categories, {
    categories: categories.map(toCategoryBackendImportPayload),
  });
};
