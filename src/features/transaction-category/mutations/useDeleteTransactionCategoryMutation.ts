import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteTransactionCategories } from "../commands";

export const useDeleteTransactionCategoryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(categoryIds: ReadonlyArray<string>) {
      return deleteTransactionCategories(categoryIds);
    },
    async onSuccess() {
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
    },
    onError() {
      toast.error("Failed to delete categories");
    },
  });
};
