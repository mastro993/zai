import { db } from "@/lib/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useDeleteTransactionCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(categoryIds: Array<number>) {
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
    },
    onError() {
      toast.error("Failed to delete categories");
    },
  });
};
