import { db } from "@/lib/database";
import { useQuery } from "@tanstack/react-query";
import { TransactionCategory } from "../schema";
import { children, parent } from "./helpers";

export const useAvailableParentTransactionCategories = () =>
  useQuery<Array<TransactionCategory>>({
    queryKey: ["transactionCategories", "parent"],
    queryFn: async () =>
      db
        .selectFrom("transaction_category")
        .selectAll("transaction_category")
        .where("parent_id", "is", null)
        .where("deleted_at", "is", null)
        .select(({ ref }) => [
          children(ref("transaction_category.id")).as("children"),
          parent(ref("transaction_category.parent_id")).as("parent"),
        ])
        .execute(),
  });
