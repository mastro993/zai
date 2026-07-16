import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import { CommandError } from "../errors";
import { invokeCommand } from "../shared";
import {
  buildTransactionsListQuery,
  buildWebRequestSpec,
  buildWebRequestUrl,
  resolveCashFlowApiBaseUrl,
} from "../web-command-map";
import { joinWebApiUrl, resolveWebApiOrigin } from "../web-api";
import { createWebCommandTransport } from "../web-transport";

const fetchMock = vi.hoisted(() => vi.fn());

describe("web command map", () => {
  it("maps get_transaction_categories without parentId to GET /categories", () => {
    expect(buildWebRequestSpec("get_transaction_categories", { parentId: null })).toEqual({
      method: "GET",
      path: "/categories",
      query: undefined,
    });
  });

  it("maps get_transaction_categories with parentId to a filtered GET /categories", () => {
    expect(buildWebRequestSpec("get_transaction_categories", { parentId: "parent-1" })).toEqual({
      method: "GET",
      path: "/categories",
      query: { parentId: "parent-1" },
    });
  });

  it("maps create_transaction_category to POST /categories with newCategory body", () => {
    const newCategory = {
      name: "Food",
      parentId: null,
      description: null,
      color: "#ff0000",
    };

    expect(
      buildWebRequestSpec("create_transaction_category", {
        newCategory,
      }),
    ).toEqual({
      method: "POST",
      path: "/categories",
      body: newCategory,
    });
  });

  it("maps update_transaction_category to PUT /categories/:id without body id", () => {
    expect(
      buildWebRequestSpec("update_transaction_category", {
        updatedCategory: {
          id: "category-1",
          name: "Dining",
          parentId: null,
          description: "Restaurants",
          color: "#123456",
        },
      }),
    ).toEqual({
      method: "PUT",
      path: "/categories/category-1",
      body: {
        name: "Dining",
        parentId: null,
        description: "Restaurants",
        color: "#123456",
      },
    });
  });

  it("maps delete_transaction_categories to POST /categories/bulk-delete", () => {
    expect(
      buildWebRequestSpec("delete_transaction_categories", {
        categoryIds: ["category-1", "category-2"],
        childrenStrategy: "promote",
      }),
    ).toEqual({
      method: "POST",
      path: "/categories/bulk-delete",
      body: {
        categoryIds: ["category-1", "category-2"],
        childrenStrategy: "promote",
      },
    });
  });

  it("maps confirmed category deletion to the bulk-delete body", () => {
    expect(
      buildWebRequestSpec("delete_transaction_categories", {
        categoryIds: ["category-1"],
        childrenStrategy: "block",
        confirmBudgetImpact: true,
      }),
    ).toEqual({
      method: "POST",
      path: "/categories/bulk-delete",
      body: {
        categoryIds: ["category-1"],
        childrenStrategy: "block",
        confirmBudgetImpact: true,
      },
    });
  });

  it("maps import_transaction_categories to POST /categories/import", () => {
    const categories = [{ name: "Food", color: "#ff0000" }];

    expect(
      buildWebRequestSpec("import_transaction_categories", {
        categories,
      }),
    ).toEqual({
      method: "POST",
      path: "/categories/import",
      body: { categories },
    });
  });

  it("maps get_transactions to GET /transactions with default pagination", () => {
    expect(buildWebRequestSpec("get_transactions")).toEqual({
      method: "GET",
      path: "/transactions?page=1&perPage=50",
    });
  });

  it("maps get_filtered_transaction_ids to POST /transactions/ids", () => {
    expect(
      buildWebRequestSpec("get_filtered_transaction_ids", {
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

  it("maps export_transactions_csv to POST /transactions/export", () => {
    expect(
      buildWebRequestSpec("export_transactions_csv", {
        request: {
          filters: { query: "coffee" },
          transactionIds: ["txn-1", "txn-2"],
        },
      }),
    ).toEqual({
      method: "POST",
      path: "/transactions/export",
      body: {
        query: "coffee",
        transactionIds: ["txn-1", "txn-2"],
      },
    });
  });

  it("maps find_existing_duplicate_keys to POST /transactions/duplicate-keys", () => {
    const candidates = [
      {
        transactionDate: "2026-01-15T08:30:00",
        amount: 1250,
        description: "Groceries",
      },
    ];

    expect(
      buildWebRequestSpec("find_existing_duplicate_keys", {
        request: { candidates },
      }),
    ).toEqual({
      method: "POST",
      path: "/transactions/duplicate-keys",
      body: { candidates },
    });
  });

  it("maps create_transaction to POST /transactions", () => {
    const newTransaction = {
      description: "Coffee",
      amount: 350,
      transactionDate: "2026-07-09T12:30:00",
      transactionType: "expense",
    };

    expect(buildWebRequestSpec("create_transaction", { newTransaction })).toEqual({
      method: "POST",
      path: "/transactions",
      body: newTransaction,
    });
  });

  it("maps update_transaction to PUT /transactions/:id without body id", () => {
    expect(
      buildWebRequestSpec("update_transaction", {
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

  it("maps delete_transaction to DELETE /transactions/:id", () => {
    expect(buildWebRequestSpec("delete_transaction", { transactionId: "txn-1" })).toEqual({
      method: "DELETE",
      path: "/transactions/txn-1",
    });
  });

  it("maps delete_transactions to POST /transactions/bulk-delete", () => {
    expect(
      buildWebRequestSpec("delete_transactions", {
        transactionIds: ["txn-1", "txn-2"],
      }),
    ).toEqual({
      method: "POST",
      path: "/transactions/bulk-delete",
      body: { transactionIds: ["txn-1", "txn-2"] },
    });
  });

  it("maps import_transactions to POST /transactions/import", () => {
    const transactions = [
      {
        description: "Coffee",
        amount: 350,
        transactionDate: "2026-07-09T12:30:00",
        transactionType: "expense",
      },
    ];

    expect(buildWebRequestSpec("import_transactions", { transactions })).toEqual({
      method: "POST",
      path: "/transactions/import",
      body: { transactions },
    });
  });

  it("maps import_transaction_batch to POST /transactions/import-batch", () => {
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

    expect(buildWebRequestSpec("import_transaction_batch", { categories, transactions })).toEqual({
      method: "POST",
      path: "/transactions/import-batch",
      body: { categories, transactions },
    });
  });

  it("builds transaction list query params from command args", () => {
    const query = buildTransactionsListQuery({
      page: 2,
      perPage: 25,
      filters: {
        query: "coffee",
        categories: ["cat-1", "cat-2"],
        transactionType: "expense",
        startDate: "2026-07-01T00:00:00",
        endDate: "2026-07-31T23:59:59",
      },
      sort: {
        field: "amount",
        desc: true,
      },
    });

    const params = new URLSearchParams(query);
    expect(params.get("page")).toBe("2");
    expect(params.get("perPage")).toBe("25");
    expect(params.get("query")).toBe("coffee");
    expect(params.getAll("categoryId")).toEqual(["cat-1", "cat-2"]);
    expect(params.get("uncategorized")).toBeNull();
    expect(params.get("transactionType")).toBe("expense");
    expect(params.get("sortField")).toBe("amount");
    expect(params.get("sortDesc")).toBe("true");
  });

  it("maps uncategorized filters to uncategorized=true", () => {
    const query = buildTransactionsListQuery({
      filters: {
        categories: [],
      },
    });

    expect(new URLSearchParams(query).get("uncategorized")).toBe("true");
  });

  it("maps date filters to startDate and endDate query params", () => {
    const query = buildTransactionsListQuery({
      filters: {
        startDate: "2026-07-01T00:00:00",
        endDate: "2026-07-31T23:59:59",
      },
    });

    const params = new URLSearchParams(query);
    expect(params.get("startDate")).toBe("2026-07-01T00:00:00");
    expect(params.get("endDate")).toBe("2026-07-31T23:59:59");
  });

  it("maps ascending sort to sortDesc=false", () => {
    const query = buildTransactionsListQuery({
      sort: {
        field: "date",
        desc: false,
      },
    });

    const params = new URLSearchParams(query);
    expect(params.get("sortField")).toBe("date");
    expect(params.get("sortDesc")).toBe("false");
  });

  it("maps get_transactions with filters to the expected REST path", () => {
    expect(
      buildWebRequestSpec("get_transactions", {
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

  it("builds absolute URLs from the configured API base", () => {
    const url = buildWebRequestUrl("http://127.0.0.1:3000/api/cash-flow", {
      method: "GET",
      path: "/categories",
      query: { parentId: "parent-1" },
    });

    expect(url).toBe("http://127.0.0.1:3000/api/cash-flow/categories?parentId=parent-1");
  });

  it("resolves the Cash flow API base from origin and feature prefix", () => {
    expect(resolveCashFlowApiBaseUrl()).toBe("http://127.0.0.1:3000/api/cash-flow");
  });
});

describe("web api config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the default API origin", () => {
    vi.stubEnv("VITE_ZAI_API_ORIGIN", "");
    expect(resolveWebApiOrigin()).toBe("http://127.0.0.1:3000");
  });

  it("strips trailing slashes from the configured API origin", () => {
    vi.stubEnv("VITE_ZAI_API_ORIGIN", "http://127.0.0.1:3000/");
    expect(resolveWebApiOrigin()).toBe("http://127.0.0.1:3000");
  });

  it("joins origin and feature prefixes without duplicate slashes", () => {
    expect(joinWebApiUrl("http://127.0.0.1:3000", "api/cash-flow")).toBe(
      "http://127.0.0.1:3000/api/cash-flow",
    );
  });
});

describe("web command map errors", () => {
  it("rejects unknown commands", () => {
    expect(() => buildWebRequestSpec("missing_command")).toThrowError(
      new CommandError("Unknown web command: missing_command"),
    );
  });
});

describe("web command transport", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "web");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns succeeded command results for 2xx JSON responses", async () => {
    const payload = [{ id: "category-1", name: "Food" }];
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const transport = createWebCommandTransport();
    const result = await transport.invoke<Array<{ id: string }>>("get_transaction_categories", {
      parentId: null,
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3000/api/cash-flow/categories", {
      method: "GET",
      headers: undefined,
      body: undefined,
    });
    expect(result).toEqual(payload);
  });

  it("preserves structured fields from non-2xx JSON error bodies", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "notFound",
          message: "Failed to load transaction: Not found",
          details: { resource: "transaction", id: "txn-404" },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const transport = createWebCommandTransport();

    await expect(
      transport.invoke("get_transaction", { transactionId: "txn-404" }),
    ).rejects.toMatchObject({
      name: "CommandError",
      code: "notFound",
      message: "Failed to load transaction: Not found",
      details: { resource: "transaction", id: "txn-404" },
    });
  });

  it("falls back to a status-derived message when error JSON is malformed", async () => {
    fetchMock.mockResolvedValue(
      new Response("not-json", {
        status: 404,
      }),
    );

    const transport = createWebCommandTransport();

    await expect(
      transport.invoke("get_transaction_categories", { parentId: null }),
    ).rejects.toEqual(new CommandError("Request failed with status 404"));
  });

  it("preserves CommandResult semantics through invokeCommand", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "validation",
          message: "Failed to create transaction category Food: bad",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await invokeCommand("create_transaction_category", {
      newCategory: { name: "Food", parentId: null, description: null, color: "#ff0000" },
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error).toBeInstanceOf(CommandError);
    expect(result.error).toMatchObject({ code: "validation" });
    expect(result.error.message).toBe("Failed to create transaction category Food: bad");
  });
});
