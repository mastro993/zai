import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";

import type { CommandError } from "@/commands/errors";

import {
  buildCreateTransactionRequest,
  buildDeleteTransactionRequest,
  buildDeleteTransactionsRequest,
  buildExportTransactionsRequest,
  buildFindDuplicateKeysRequest,
  buildGetFilteredTransactionIdsRequest,
  buildGetTransactionRequest,
  buildGetTransactionsRequest,
  buildImportTransactionBatchRequest,
  buildImportTransactionsRequest,
  buildUpdateTransactionRequest,
} from "../web-requests";

const unwrap = <T>(result: Result.Result<T, CommandError>): T | undefined => {
  expect(Result.isSuccess(result)).toBe(true);
  return Result.isSuccess(result) ? result.value : undefined;
};

const transaction = {
  description: "Coffee",
  amount: 350,
  transactionDate: "2026-07-09T12:30:00",
  transactionType: "expense",
};

describe("transaction web requests", () => {
  it("maps transaction pagination, filters, and sorting", () => {
    expect(unwrap(buildGetTransactionsRequest({}))).toEqual({
      method: "GET",
      path: "/transactions",
      query: { page: "1", perPage: "50" },
    });
    expect(
      unwrap(
        buildGetTransactionsRequest({
          page: 2,
          perPage: 25,
          filters: {
            query: "coffee",
            categories: ["cat-1", "cat-2"],
            transactionType: "expense",
            startDate: "2026-07-01T00:00:00",
            endDate: "2026-07-31T23:59:59",
          },
          sort: { field: "amount", desc: true },
        }),
      ),
    ).toEqual({
      method: "GET",
      path: "/transactions",
      query: {
        page: "2",
        perPage: "25",
        query: "coffee",
        transactionType: "expense",
        startDate: "2026-07-01T00:00:00",
        endDate: "2026-07-31T23:59:59",
        categoryId: ["cat-1", "cat-2"],
        sortField: "amount",
        sortDesc: "true",
      },
    });
    expect(
      unwrap(
        buildGetTransactionsRequest({
          filters: { categories: [] },
          sort: { field: "date", desc: false },
        }),
      ),
    ).toEqual({
      method: "GET",
      path: "/transactions",
      query: {
        page: "1",
        perPage: "50",
        uncategorized: "true",
        sortField: "date",
        sortDesc: "false",
      },
    });
  });

  it("maps ids, exports, and duplicate lookup", () => {
    expect(
      unwrap(
        buildGetFilteredTransactionIdsRequest({
          filters: { query: "rent", categories: [], transactionType: "expense" },
          sort: { field: "date", desc: true },
        }),
      ),
    ).toEqual({
      method: "POST",
      path: "/transactions/ids",
      body: {
        query: "rent",
        uncategorized: "true",
        transactionType: "expense",
        sortField: "date",
        sortDesc: true,
      },
    });
    const candidates = [
      { transactionDate: "2026-01-15T08:30:00", amount: 1250, description: "Groceries" },
    ];
    expect(unwrap(buildFindDuplicateKeysRequest({ request: { candidates } }))).toEqual({
      method: "POST",
      path: "/transactions/duplicate-keys",
      body: { candidates },
    });
    expect(
      unwrap(
        buildExportTransactionsRequest({
          request: {
            filters: { query: "coffee", categories: [] },
            transactionIds: ["txn-1", "txn-2"],
          },
        }),
      ),
    ).toEqual({
      method: "POST",
      path: "/transactions/export",
      body: { query: "coffee", uncategorized: "true", transactionIds: ["txn-1", "txn-2"] },
    });
  });

  it("maps detail, mutation, deletion, and imports", () => {
    expect(unwrap(buildGetTransactionRequest({ transactionId: "txn-1" }))).toEqual({
      method: "GET",
      path: "/transactions/txn-1",
    });
    expect(unwrap(buildCreateTransactionRequest({ newTransaction: transaction }))).toEqual({
      method: "POST",
      path: "/transactions",
      body: transaction,
    });
    expect(
      unwrap(
        buildUpdateTransactionRequest({ updatedTransaction: { ...transaction, id: "txn-1" } }),
      ),
    ).toEqual({
      method: "PUT",
      path: "/transactions/txn-1",
      body: transaction,
    });
    expect(unwrap(buildDeleteTransactionRequest({ transactionId: "txn-1" }))).toEqual({
      method: "DELETE",
      path: "/transactions/txn-1",
    });
    expect(unwrap(buildDeleteTransactionsRequest({ transactionIds: ["txn-1", "txn-2"] }))).toEqual({
      method: "POST",
      path: "/transactions/bulk-delete",
      body: { transactionIds: ["txn-1", "txn-2"] },
    });
    const transactions = [{ ...transaction, id: "txn-1" }];
    expect(unwrap(buildImportTransactionsRequest({ transactions }))).toEqual({
      method: "POST",
      path: "/transactions/import",
      body: { transactions },
    });
    const categories = [{ name: "Food", color: "#C55B26" }];
    expect(unwrap(buildImportTransactionBatchRequest({ categories, transactions }))).toEqual({
      method: "POST",
      path: "/transactions/import-batch",
      body: { categories, transactions },
    });
  });

  it("rejects malformed runtime values locally", () => {
    expect(Result.isFailure(buildGetTransactionRequest({ transactionId: "" }))).toBe(true);
    expect(Result.isFailure(buildGetTransactionsRequest({ page: 0 }))).toBe(true);
    expect(Result.isFailure(buildDeleteTransactionsRequest({ transactionIds: [] }))).toBe(true);
  });
});
