import { db } from "@/lib/database";
import { NewTransaction, Transaction } from "@/lib/database/schema/transaction";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

type TransactionPage = {
  data: Transaction[];
  page: number;
};

const PAGE_SIZE = 1000;

export const useTransactionList = () =>
  useInfiniteQuery<TransactionPage>({
    queryKey: ["transactions"],
    queryFn: async ({ pageParam = 0 }) => {
      const page = pageParam as number;

      const dbTransactions = await db
        .selectFrom("transactions")
        .selectAll()
        .limit(PAGE_SIZE)
        .offset(page * PAGE_SIZE)
        .execute();

      console.debug("🔍 Fetched transactions", dbTransactions);

      return {
        data: dbTransactions,
        page,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: TransactionPage) => lastPage.page + 1,
  });

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
    },
    onError(error) {
      console.log(error);
    },
  });
};
