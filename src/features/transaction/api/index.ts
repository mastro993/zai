import { db } from "@/lib/database";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { NewTransaction, Transaction } from "../schema";
import { category } from "../schema/helpers";
const PAGE_SIZE = 1000;

export const transactionApi = createApi({
  reducerPath: "transactions",
  tagTypes: ["transactions"],
  baseQuery: fakeBaseQuery(),
  endpoints: (build) => ({
    getTransactions: build.infiniteQuery<Transaction[], void, number>({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (
          _lastPage,
          _allPages,
          lastPageParam,
          _allPageParams
        ) => lastPageParam + 1,
        // Optionally provide a `getPreviousPageParam` function
        getPreviousPageParam: (
          _firstPage,
          _allPages,
          firstPageParam,
          _allPageParams
        ) => {
          return firstPageParam > 0 ? firstPageParam - 1 : undefined;
        },
      },
      queryFn: async ({ pageParam }) => {
        const dbTransactions = await db
          .selectFrom("transaction")
          .selectAll("transaction")
          .limit(PAGE_SIZE)
          .offset(pageParam * PAGE_SIZE)
          .select(({ ref }) => [
            category(ref("transaction.category_id")).as("category"),
          ])
          .execute();

        return {
          data: dbTransactions,
        };
      },
      providesTags: ["transactions"],
    }),
    addTransaction: build.mutation<number, NewTransaction>({
      queryFn: async (transaction) => {
        const results = await db
          .insertInto("transaction")
          .values(transaction)
          .executeTakeFirstOrThrow();

        return {
          data: results.insertId as unknown as number,
          error: undefined,
        };
      },
      invalidatesTags: ["transactions"],
    }),
  }),
});

export const { useGetTransactionsInfiniteQuery, useAddTransactionMutation } =
  transactionApi;
