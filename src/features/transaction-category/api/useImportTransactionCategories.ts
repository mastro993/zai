import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NewTransactionCategories } from "../types";
import { importTransactionCategories } from "../commands";

export const useImportTransactionCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(transactionCategories: NewTransactionCategories) {
      return importTransactionCategories(transactionCategories);
    },
    async onSuccess(data) {
      await queryClient.invalidateQueries({
        queryKey: ["transactionCategories"],
      });
      toast.success(`${data.length} transaction categories imported`);
    },
    onError() {
      toast.error("Failed to import transaction categories");
    },
  });
};
