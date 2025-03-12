import { withDb } from "@/lib/db";
import { useInfiniteQuery } from "@tanstack/react-query";

export type TransactionType = "expense" | "income";

export type Transaction = {
  id: number;
  date: string;
  name: string;
  amount: number;
  currency: string;
  type: TransactionType;
  category_id: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
};

type TransactionPage = {
  data: Transaction[];
  page: number;
};

const getTransactions = withDb<Transaction[], number>(
  async (db, page: number) => {
    const dbTransactions = await db.select<Transaction[]>(
      "SELECT * FROM transactions ORDER BY date DESC LIMIT $1 OFFSET $2",
      [PAGE_SIZE, page * PAGE_SIZE]
    );

    return dbTransactions;
  }
);

const PAGE_SIZE = 10;

export const useTransactionList = () =>
  useInfiniteQuery<TransactionPage>({
    queryKey: ["transactions"],
    queryFn: async ({ pageParam = 0 }) => {
      const page = pageParam as number;

      const dbTransactions = await getTransactions(page);

      return {
        data: dbTransactions,
        page,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: TransactionPage) => lastPage.page + 1,
  });
