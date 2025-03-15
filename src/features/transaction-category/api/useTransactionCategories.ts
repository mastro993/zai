import { db } from "@/lib/database";
import { useQuery } from "@tanstack/react-query";
import { TransactionCategory } from "../schema";
import { children, parent } from "./helpers";

export const useTransactionCategories = () =>
  useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories"],
    queryFn: async () =>
      db
        .selectFrom("transaction_categories")
        .selectAll("transaction_categories")
        .select(({ ref }) => [
          children(ref("transaction_categories.id")).as("children"),
          parent(ref("transaction_categories.parent_id")).as("parent"),
        ])
        .execute(),
  });
