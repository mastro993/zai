import { type CommandResult, invokeCommand } from "@/commands/shared";

import type { CategoryImportPayload } from "../lib/category-import";
import type {
  CategoryChildrenDeleteStrategy,
  CategoryFormValues,
  CategoryRole,
  TransactionCategory,
} from "../types/model";

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
  return invokeCommand<Array<TransactionCategory>>("get_transaction_categories", {
    parentId: parentId ?? null,
  });
};

export const createTransactionCategory = (
  values: CategoryFormValues,
): CommandResult<TransactionCategory> => {
  return invokeCommand<TransactionCategory>("create_transaction_category", {
    newCategory: toCategoryPayload(values),
  });
};

export const updateTransactionCategory = (
  id: string,
  values: CategoryFormValues,
): CommandResult<TransactionCategory> => {
  return invokeCommand<TransactionCategory>("update_transaction_category", {
    updatedCategory: {
      id,
      ...toCategoryPayload(values),
    },
  });
};

export const deleteTransactionCategories = (
  categoryIds: Array<string>,
  childrenStrategy: CategoryChildrenDeleteStrategy = "block",
): CommandResult<Array<TransactionCategory>> => {
  return invokeCommand<Array<TransactionCategory>>("delete_transaction_categories", {
    categoryIds,
    childrenStrategy,
  });
};

export const importTransactionCategories = (
  categories: Array<CategoryImportPayload>,
): CommandResult<Array<TransactionCategory>> => {
  return invokeCommand<Array<TransactionCategory>>("import_transaction_categories", {
    categories,
  });
};
