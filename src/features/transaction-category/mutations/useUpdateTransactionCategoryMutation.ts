import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { NewTransactionCategory } from "../types";
import { updateTransactionCategory } from "../commands";

export const useUpdateTransactionCategoryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(category: NewTransactionCategory) {
      return updateTransactionCategory(category);
    },
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
      toast.success("Transaction category updated");
    },
    onError() {
      toast.error("Failed to update transaction category");
    },
  });
};
