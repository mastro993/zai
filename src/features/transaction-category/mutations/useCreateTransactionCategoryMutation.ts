import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { NewTransactionCategory } from "../types";
import { createTransactionCategory } from "../commands";

export const useCreateTransactionCategoryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(transactionCategory: NewTransactionCategory) {
      return createTransactionCategory(transactionCategory);
    },
    async onSuccess({ name }) {
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
      toast.success(`Successfully added "${name}" category`);
    },
    onError() {
      toast.error("Failed to add new transaction category");
    },
  });
};
