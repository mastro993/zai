import { db } from "@/lib/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TransactionCategory } from "../schema";

export const useDeleteTransactionCategory = (category: TransactionCategory) => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn() {
      const results = await db
        .deleteFrom("transaction_category")
        .where("id", "=", category.id)
        .execute();

      return results;
    },
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
      toast.success(`"${category.name}" category deleted`);
    },
    onError() {
      toast.error("Failed to delete transaction category");
    },
  });
};

export const useDeleteMultipleTransactionCategory = (
  categoryIds: Array<number>,
  onSuccess?: () => void
) => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn() {
      const results = await db
        .deleteFrom("transaction_category")
        .where("id", "in", categoryIds)
        .execute();

      return results;
    },
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
      toast.success(`${categoryIds.length} categories deleted`);
      onSuccess?.();
    },
    onError() {
      toast.error("Failed to delete transaction category");
    },
  });
};
