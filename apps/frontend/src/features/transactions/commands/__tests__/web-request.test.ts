import { describe, expect, it } from "vitest";

import { buildTransactionCommandRequestSpec } from "../web-command-map";

describe("transaction web requests", () => {
  it("maps transaction list defaults and filters", () => {
    expect(buildTransactionCommandRequestSpec("get_transactions")).toEqual({
      method: "GET",
      path: "/transactions?page=1&perPage=50",
    });
    expect(
      buildTransactionCommandRequestSpec("get_transactions", {
        page: 2,
        perPage: 25,
        filters: {
          query: "coffee",
          categories: ["cat-1"],
          transactionType: "expense",
          startDate: "2026-07-01T00:00:00",
          endDate: "2026-07-31T23:59:59",
        },
        sort: {
          field: "amount",
          desc: true,
        },
      }),
    ).toEqual({
      method: "GET",
      path: "/transactions?page=2&perPage=25&query=coffee&transactionType=expense&startDate=2026-07-01T00%3A00%3A00&endDate=2026-07-31T23%3A59%3A59&categoryId=cat-1&sortField=amount&sortDesc=true",
    });
  });

  it("serializes uncategorized and ascending-sort filters", () => {
    expect(
      buildTransactionCommandRequestSpec("get_transactions", {
        filters: { categories: [] },
        sort: { field: "date", desc: false },
      }),
    ).toEqual({
      method: "GET",
      path: "/transactions?page=1&perPage=50&uncategorized=true&sortField=date&sortDesc=false",
    });
  });

  it("maps transaction detail reads", () => {
    expect(
      buildTransactionCommandRequestSpec("get_transaction", { transactionId: "txn-1" }),
    ).toEqual({
      method: "GET",
      path: "/transactions/txn-1",
    });
  });

  it("maps filtered ids with filters and sorting in the body", () => {
    expect(
      buildTransactionCommandRequestSpec("get_filtered_transaction_ids", {
        filters: { query: "rent", categories: [], transactionType: "expense" },
        sort: { field: "date", desc: true },
      }),
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
  });

  it("maps exports and duplicate lookup requests", () => {
    const candidates = [
      {
        transactionDate: "2026-01-15T08:30:00",
        amount: 1250,
        description: "Groceries",
      },
    ];
    expect(
      buildTransactionCommandRequestSpec("find_existing_duplicate_keys", {
        request: { candidates },
      }),
    ).toEqual({
      method: "POST",
      path: "/transactions/duplicate-keys",
      body: { candidates },
    });

    expect(
      buildTransactionCommandRequestSpec("export_transactions_csv", {
        request: {
          filters: { query: "coffee", categories: [] },
          transactionIds: ["txn-1", "txn-2"],
        },
      }),
    ).toEqual({
      method: "POST",
      path: "/transactions/export",
      body: {
        query: "coffee",
        uncategorized: "true",
        transactionIds: ["txn-1", "txn-2"],
      },
    });
  });

  it("maps transaction creation and removes ids from updates", () => {
    const newTransaction = {
      description: "Coffee",
      amount: 350,
      transactionDate: "2026-07-09T12:30:00",
      transactionType: "expense",
    };
    expect(buildTransactionCommandRequestSpec("create_transaction", { newTransaction })).toEqual({
      method: "POST",
      path: "/transactions",
      body: newTransaction,
    });

    expect(
      buildTransactionCommandRequestSpec("update_transaction", {
        updatedTransaction: {
          id: "txn-1",
          description: "Updated",
          amount: 100,
          transactionDate: "2026-07-09T12:30:00",
          transactionType: "expense",
        },
      }),
    ).toEqual({
      method: "PUT",
      path: "/transactions/txn-1",
      body: {
        description: "Updated",
        amount: 100,
        transactionDate: "2026-07-09T12:30:00",
        transactionType: "expense",
      },
    });
  });

  it("maps single and bulk deletion", () => {
    expect(
      buildTransactionCommandRequestSpec("delete_transaction", { transactionId: "txn-1" }),
    ).toEqual({
      method: "DELETE",
      path: "/transactions/txn-1",
    });
    expect(
      buildTransactionCommandRequestSpec("delete_transactions", {
        transactionIds: ["txn-1", "txn-2"],
      }),
    ).toEqual({
      method: "POST",
      path: "/transactions/bulk-delete",
      body: { transactionIds: ["txn-1", "txn-2"] },
    });
  });

  it("maps transaction and batch imports", () => {
    const categories = [{ name: "Food", color: "#ff0000" }];
    const transactions = [
      {
        description: "Coffee",
        amount: 350,
        transactionDate: "2026-07-09T12:30:00",
        transactionType: "expense",
        categoryName: "Food",
      },
    ];
    expect(buildTransactionCommandRequestSpec("import_transactions", { transactions })).toEqual({
      method: "POST",
      path: "/transactions/import",
      body: { transactions },
    });
    expect(
      buildTransactionCommandRequestSpec("import_transaction_batch", { categories, transactions }),
    ).toEqual({
      method: "POST",
      path: "/transactions/import-batch",
      body: { categories, transactions },
    });
  });
});
