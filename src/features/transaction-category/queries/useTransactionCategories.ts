import { useQuery } from "@tanstack/react-query";
import { getTransactionCategories } from "../commands";
import { TransactionCategory } from "../types";

export const useTransactionCategories = () =>
  useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories"],
    queryFn: async () => getTransactionCategories(),
  });
