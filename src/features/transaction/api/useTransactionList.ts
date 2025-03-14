import { db } from "@/lib/database";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Transaction } from "../schema";
import { jsonArrayFrom } from "kysely/helpers/sqlite";
import { jsonObjectFrom } from "kysely/helpers/sqlite";

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
        .select((eb) => [
          jsonObjectFrom(
            eb
              .selectFrom("transaction_categories")
              .selectAll()
              .whereRef(
                "transaction_categories.id",
                "=",
                "transactions.category_id"
              )
          ).as("category"),
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
