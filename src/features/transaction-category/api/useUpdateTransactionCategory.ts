import { db } from "@/lib/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TransactionCategory, TransactionCategoryUpdate } from "../schema";
import { sql } from "kysely";

export const useUpdateTransactionCategory = (category: TransactionCategory) => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(payload: TransactionCategoryUpdate) {
      const results = await db
        .updateTable("transaction_category")
        .set({
          ...payload,
          updated_at: sql`current_timestamp`,
        })
        .where("id", "=", category.id)
        .execute();

      return results;
    },
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
      toast.success("Transaction category updated");
    },
    onError() {
      toast.error("Failed to add transaction category");
    },
  });
};
