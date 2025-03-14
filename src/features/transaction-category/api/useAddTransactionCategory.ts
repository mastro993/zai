import { db } from "@/lib/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { NewTransactionCategory } from "../schema";

export const useAddTransactionCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(transactionCategory: NewTransactionCategory) {
      const results = await db
        .insertInto("transaction_categories")
        .values(transactionCategory)
        .execute();

      return results;
    },
    async onSuccess() {
      toast.success("Transaction category added");
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
    },
    onError() {
      toast.error("Failed to add transaction category");
    },
  });
};
