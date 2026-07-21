import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";

import type { CategoryImportPayload } from "../lib/category-import";
import type {
  CategoryChildrenDeleteStrategy,
  CategoryDeletionPreview,
  CategoryFormValues,
  CategoryRole,
  TransactionCategory,
} from "../types/model";
import { CATEGORY_COMMANDS } from "./registry";

type CategoryPayload = {
  id?: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  role?: CategoryRole | null;
};

const toCategoryPayload = (values: CategoryFormValues): CategoryPayload => ({
  name: values.name,
  parentId: values.parentId || null,
  description: values.description || null,
  color: values.color ?? null,
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
  return invokeDecodedCommand(CATEGORY_COMMANDS.update_transaction_category, {
    updatedCategory: {
      id,
      ...toCategoryPayload(values),
      ...(confirmBudgetImpact ? { confirmBudgetImpact: true } : {}),
    },
  });
};

export const deleteTransactionCategories = (
  categoryIds: Array<string>,
  childrenStrategy: CategoryChildrenDeleteStrategy = "block",
  confirmBudgetImpact = false,
): CommandResult<Array<TransactionCategory>> => {
  return invokeDecodedCommand(CATEGORY_COMMANDS.delete_transaction_categories, {
    categoryIds,
    childrenStrategy,
    ...(confirmBudgetImpact ? { confirmBudgetImpact: true } : {}),
  });
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
    categories,
  });
};
