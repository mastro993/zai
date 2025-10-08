import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteTransactionCategories } from "../commands";

export const useDeleteTransactionCategoryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(categoryIds: ReadonlyArray<string>) {
      return deleteTransactionCategories(categoryIds);
    },
    async onSuccess(data) {
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
      if (data.length === 1) {
        const { name } = data[0];
        toast.success(`"${name}" category deleted successfully`);
      } else {
        toast.success(`Successfully deleted ${data.length} categories`);
      }
    },
    onError() {
      toast.error("Failed to delete categories");
    },
  });
};
