import { useQuery } from "@tanstack/react-query";
import { getTransactionCategories } from "../commands";
import { TransactionCategory } from "../types";

export const useParentTransactionCategories = () =>
  useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories", "parent"],
    queryFn: async () => {
      const categories = await getTransactionCategories();
      return categories.filter((category) => !category.parentId);
    },
  });
