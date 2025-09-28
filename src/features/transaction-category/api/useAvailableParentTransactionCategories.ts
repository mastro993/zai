import { useQuery } from "@tanstack/react-query";
import { getTransactionCategories } from "../commands";
import { TransactionCategory } from "../types";

export const useAvailableParentTransactionCategories = () =>
  useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories", "parent"],
    queryFn: async () =>
      (await getTransactionCategories()).filter((c) => c.parent_id === null),
  });
