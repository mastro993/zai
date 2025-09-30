import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NewTransactionCategory } from "../types";
import { createTransactionCategory } from "../commands";

export const useCreateTransactionCategoryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(transactionCategory: NewTransactionCategory) {
      return createTransactionCategory(transactionCategory);
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
