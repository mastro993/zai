import { db } from "@/lib/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { NewTransaction } from "../schema";

export const useAddTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(transaction: NewTransaction) {
      const results = await db
        .insertInto("transactions")
        .values(transaction)
        .execute();

      return results;
    },
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transaction added");
    },
    onError() {
      toast.error("Failed to add transaction");
    },
  });
};
