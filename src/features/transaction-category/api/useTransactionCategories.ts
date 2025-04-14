import { db } from "@/lib/database";
import { useQuery } from "@tanstack/react-query";
import { TransactionCategory } from "../schema";
import { children, parent } from "../schema/helpers";

export const useTransactionCategories = () =>
  useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories"],
    queryFn: async () =>
      db
        .selectFrom("transaction_category")
        .selectAll("transaction_category")
        .where("deleted_at", "is", null)
        .select(({ ref }) => [
          children(ref("transaction_category.id")).as("children"),
          parent(ref("transaction_category.parent_id")).as("parent"),
        ])
        .execute(),
  });
