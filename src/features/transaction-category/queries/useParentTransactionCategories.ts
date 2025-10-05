import { useQuery } from "@tanstack/react-query";
import { getTransactionCategories } from "../commands";
import { TransactionCategory } from "../types";

export const useParentTransactionCategories = () =>
  useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories"],
    queryFn: getTransactionCategories,
    select: (categories) => categories.filter((c) => !c.parentId),
  });
