import { useInfiniteQuery } from "@tanstack/react-query";
import Database from "@tauri-apps/plugin-sql";

type Transaction = {
  id: string;
  amount: number;
  date: string;
  description: string;
};

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

      const db = await Database.load("sqlite:test.db");
      const dbTransactions = await db.select<Transaction[]>(
        "SELECT * FROM transactions ORDER BY date DESC LIMIT $1 OFFSET $2",
        [PAGE_SIZE, page * PAGE_SIZE]
      );

      return {
        data: dbTransactions,
        page,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: TransactionPage) => lastPage.page + 1,
  });
