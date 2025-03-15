import { db } from "@/lib/database";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Transaction } from "../schema";
import { category } from "./helpers";

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
        .selectFrom("transaction")
        .selectAll("transaction")
        .limit(PAGE_SIZE)
        .offset(page * PAGE_SIZE)
        .select(({ ref }) => [
          category(ref("transaction.category_id")).as("category"),
        ])
        .execute();

      return {
        data: dbTransactions,
        page,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: TransactionPage) => lastPage.page + 1,
  });
