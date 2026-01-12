import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useAddTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async mutationFn(_transaction: unknown) {
      return [];
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
