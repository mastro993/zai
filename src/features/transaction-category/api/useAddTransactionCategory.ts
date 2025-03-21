import { db } from "@/lib/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NewTransactionCategory } from "../schema";

export const useAddTransactionCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(transactionCategory: NewTransactionCategory) {
      const results = await db
        .insertInto("transaction_category")
        .values(transactionCategory)
        .execute();

      return results;
    },
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
      toast.success("Transaction category added");
    },
    onError() {
      toast.error("Failed to add transaction category");
    },
  });
};
