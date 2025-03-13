import { db } from "@/database";
import { Transaction } from "@/database/schema/transaction";
import { useInfiniteQuery } from "@tanstack/react-query";

type TransactionPage = {
  data: Transaction[];
  page: number;
};

const PAGE_SIZE = 10;

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
