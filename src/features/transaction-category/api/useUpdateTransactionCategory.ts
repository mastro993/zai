import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NewTransactionCategory } from "../types";
import { updateTransactionCategory } from "../commands";

export const useUpdateTransactionCategory = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  category: NewTransactionCategory
) => {
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
      toast.error("Failed to add transaction category");
    },
  });
};
