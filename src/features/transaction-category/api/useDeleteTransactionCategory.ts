import { db } from "@/lib/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export const useDeleteTransactionCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(id: number) {
      const results = await db
        .deleteFrom("transaction_category")
        .where("id", "=", id)
        .execute();

      return results;
    },
    async onSuccess(data) {
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
      toast.success("Transaction category deleted");
    },
    onError() {
      toast.error("Failed to delete transaction category");
    },
  });
};
