import { useQuery } from "@tanstack/react-query";
import { getTransactionCategories } from "../commands";
import type { TransactionCategory } from "../types";

export const useTransactionCategories = () =>
  useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories"],
    queryFn: async () => getTransactionCategories(),
  });
