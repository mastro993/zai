import { useQuery } from "@tanstack/react-query";
import { getTransactionCategories } from "../commands";
import type { TransactionCategory } from "../types";

/**
 * Fetch categories that can be used as parents.
 * When editingCategoryId is provided, excludes that category and its children
 * to prevent circular references and self-assignment.
 */
export const useParentTransactionCategories = (editingCategoryId?: string) => {
  return useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories", "parents", editingCategoryId],
    queryFn: async () => getTransactionCategories(),
    select: (categories) => {
      // Only root categories (no parent) can be parents
      let result = categories.filter((c) => !c.parentId);

      // When editing, exclude the category being edited and any children it has
      if (editingCategoryId) {
        result = result.filter(
          (c) => c.id !== editingCategoryId && c.parentId !== editingCategoryId,
        );
      }

      return result;
    },
  });
};
