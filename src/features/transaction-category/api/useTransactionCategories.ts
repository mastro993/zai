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
        .selectAll()
        .select(({ ref }) => [
          children(ref("parent_id")).as("children"),
          parent(ref("parent_id")).as("parent"),
        ])
        .execute(),
  });
