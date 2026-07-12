import { CommandError } from "./errors";
import type { CommandArgs } from "./types";
import { joinWebApiUrl, resolveWebApiOrigin } from "./web-api";

export const CASH_FLOW_API_PREFIX = "api/cash-flow";

export type WebRequestSpec = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  return value;
};

const readRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

const readStringArray = (value: unknown): Array<string> | undefined => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }

  return value;
};

const omitId = (payload: Record<string, unknown>): Record<string, unknown> => {
  const { id: _id, ...rest } = payload;
  return rest;
};

export const resolveCashFlowApiBaseUrl = (): string =>
  joinWebApiUrl(resolveWebApiOrigin(), CASH_FLOW_API_PREFIX);

const readNumber = (value: unknown, fallback: number): number => {
  return typeof value === "number" ? value : fallback;
};

export const buildTransactionsListQuery = (args: CommandArgs = {}): string => {
  const params = new URLSearchParams();
  params.set("page", String(readNumber(args.page, 1)));
  params.set("perPage", String(readNumber(args.perPage, 50)));

  const filters = readRecord(args.filters);
  if (filters?.query && typeof filters.query === "string") {
    params.set("query", filters.query);
  }
  if (filters?.transactionType && typeof filters.transactionType === "string") {
    params.set("transactionType", filters.transactionType);
  }
  if (filters?.startDate && typeof filters.startDate === "string") {
    params.set("startDate", filters.startDate);
  }
  if (filters?.endDate && typeof filters.endDate === "string") {
    params.set("endDate", filters.endDate);
  }
  if (Array.isArray(filters?.categories)) {
    if (filters.categories.length === 0) {
      params.set("uncategorized", "true");
    } else {
      for (const categoryId of filters.categories) {
        if (typeof categoryId === "string") {
          params.append("categoryId", categoryId);
        }
      }
    }
  }

  const sort = readRecord(args.sort);
  if (sort?.field && typeof sort.field === "string") {
    params.set("sortField", sort.field);
    params.set("sortDesc", String(sort.desc === true));
  }

  return params.toString();
};

export const buildWebRequestSpec = (command: string, args: CommandArgs = {}): WebRequestSpec => {
  switch (command) {
    case "get_transaction_categories": {
      const parentId = readString(args.parentId);
      return {
        method: "GET",
        path: "/categories",
        query: parentId ? { parentId } : undefined,
      };
    }
    case "get_transaction_category": {
      const categoryId = readString(args.categoryId);
      if (!categoryId) {
        throw new CommandError("get_transaction_category requires categoryId");
      }
      return {
        method: "GET",
        path: `/categories/${categoryId}`,
      };
    }
    case "create_transaction_category": {
      const newCategory = readRecord(args.newCategory);
      if (!newCategory) {
        throw new CommandError("create_transaction_category requires newCategory");
      }
      return {
        method: "POST",
        path: "/categories",
        body: newCategory,
      };
    }
    case "update_transaction_category": {
      const updatedCategory = readRecord(args.updatedCategory);
      const categoryId = readString(updatedCategory?.id);
      if (!updatedCategory || !categoryId) {
        throw new CommandError("update_transaction_category requires updatedCategory.id");
      }
      return {
        method: "PUT",
        path: `/categories/${categoryId}`,
        body: omitId(updatedCategory),
      };
    }
    case "delete_transaction_categories": {
      const categoryIds = readStringArray(args.categoryIds);
      if (!categoryIds) {
        throw new CommandError("delete_transaction_categories requires categoryIds");
      }
      return {
        method: "POST",
        path: "/categories/bulk-delete",
        body: {
          categoryIds,
          ...(args.childrenStrategy ? { childrenStrategy: args.childrenStrategy } : {}),
        },
      };
    }
    case "import_transaction_categories": {
      const categories = args.categories;
      if (!Array.isArray(categories)) {
        throw new CommandError("import_transaction_categories requires categories");
      }
      return {
        method: "POST",
        path: "/categories/import",
        body: { categories },
      };
    }
    case "get_transactions": {
      const search = buildTransactionsListQuery(args);
      return {
        method: "GET",
        path: search ? `/transactions?${search}` : "/transactions",
      };
    }
    case "get_transaction": {
      const transactionId = readString(args.transactionId);
      if (!transactionId) {
        throw new CommandError("get_transaction requires transactionId");
      }
      return {
        method: "GET",
        path: `/transactions/${transactionId}`,
      };
    }
    case "create_transaction": {
      const newTransaction = readRecord(args.newTransaction);
      if (!newTransaction) {
        throw new CommandError("create_transaction requires newTransaction");
      }
      return {
        method: "POST",
        path: "/transactions",
        body: newTransaction,
      };
    }
    case "update_transaction": {
      const updatedTransaction = readRecord(args.updatedTransaction);
      const transactionId = readString(updatedTransaction?.id);
      if (!updatedTransaction || !transactionId) {
        throw new CommandError("update_transaction requires updatedTransaction.id");
      }
      return {
        method: "PUT",
        path: `/transactions/${transactionId}`,
        body: omitId(updatedTransaction),
      };
    }
    case "delete_transaction": {
      const transactionId = readString(args.transactionId);
      if (!transactionId) {
        throw new CommandError("delete_transaction requires transactionId");
      }
      return {
        method: "DELETE",
        path: `/transactions/${transactionId}`,
      };
    }
    case "delete_transactions": {
      const transactionIds = readStringArray(args.transactionIds);
      if (!transactionIds) {
        throw new CommandError("delete_transactions requires transactionIds");
      }
      return {
        method: "POST",
        path: "/transactions/bulk-delete",
        body: { transactionIds },
      };
    }
    case "import_transactions": {
      const transactions = args.transactions;
      if (!Array.isArray(transactions)) {
        throw new CommandError("import_transactions requires transactions");
      }
      return {
        method: "POST",
        path: "/transactions/import",
        body: { transactions },
      };
    }
    case "import_transaction_batch": {
      const categories = args.categories;
      const transactions = args.transactions;
      if (!Array.isArray(categories) || !Array.isArray(transactions)) {
        throw new CommandError("import_transaction_batch requires categories and transactions");
      }
      return {
        method: "POST",
        path: "/transactions/import-batch",
        body: { categories, transactions },
      };
    }
    case "get_budgets":
      return {
        method: "GET",
        path: "/budgets",
      };
    case "get_budget": {
      const budgetId = readString(args.budgetId);
      if (!budgetId) {
        return {
          method: "GET",
          path: "/budgets/__missing_budget_id__",
        };
      }
      return {
        method: "GET",
        path: `/budgets/${budgetId}`,
      };
    }
    case "create_budget": {
      const newBudget = readRecord(args.newBudget);
      if (!newBudget) {
        return {
          method: "POST",
          path: "/budgets",
          body: {},
        };
      }
      return {
        method: "POST",
        path: "/budgets",
        body: newBudget,
      };
    }
    default:
      throw new CommandError(`Unknown web command: ${command}`);
  }
};

export const buildWebRequestUrl = (baseUrl: string, spec: WebRequestSpec): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const normalizedPath = spec.path.startsWith("/") ? spec.path : `/${spec.path}`;
  const url = new URL(`${normalizedBaseUrl}${normalizedPath}`);
  if (spec.query) {
    for (const [key, value] of Object.entries(spec.query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
};
