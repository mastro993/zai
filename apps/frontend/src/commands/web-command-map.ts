import { CommandError } from "./errors";
import type { CommandArgs } from "./types";
import { joinWebApiUrl, resolveWebApiOrigin } from "./web-api";

export const CASH_FLOW_API_PREFIX = "api/cash-flow";
export const ALERTS_API_PREFIX = "api";

const ALERT_COMMANDS = new Set(["list_alerts", "get_unread_alert_count"]);

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

export const resolveAlertsApiBaseUrl = (): string =>
  joinWebApiUrl(resolveWebApiOrigin(), ALERTS_API_PREFIX);

export const resolveWebApiBaseUrlForCommand = (command: string): string =>
  ALERT_COMMANDS.has(command) ? resolveAlertsApiBaseUrl() : resolveCashFlowApiBaseUrl();

const readNumber = (value: unknown, fallback: number): number => {
  return typeof value === "number" ? value : fallback;
};

const buildAlertsListSearch = (args: CommandArgs = {}): string => {
  const query = readRecord(args.query);
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();
  const cursor = readString(query.cursor);
  if (cursor) {
    params.set("cursor", cursor);
  }
  if (typeof query.limit === "number") {
    params.set("limit", String(query.limit));
  }
  const readState = readString(query.readState);
  if (readState && readState !== "all") {
    params.set("readState", readState);
  }
  const severities = readStringArray(query.severities);
  if (severities) {
    for (const severity of severities) {
      params.append("severities", severity);
    }
  }

  return params.toString();
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
          ...(args.confirmBudgetImpact ? { confirmBudgetImpact: true } : {}),
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
    case "get_budgets": {
      const filter = readString(args.filter);
      return {
        method: "GET",
        path: "/budgets",
        query: filter ? { filter } : undefined,
      };
    }
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
    case "get_budget_history": {
      const budgetId = readString(args.budgetId);
      if (!budgetId) {
        return {
          method: "GET",
          path: "/budgets/__missing_budget_id__/history",
        };
      }
      const page = readNumber(args.page, 1);
      const perPage = readNumber(args.perPage, 50);
      return {
        method: "GET",
        path: `/budgets/${budgetId}/history?page=${page}&perPage=${perPage}`,
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
    case "update_budget": {
      const budgetId = readString(args.budgetId);
      const updatedBudget = readRecord(args.updatedBudget);
      if (!budgetId || !updatedBudget) {
        return {
          method: "PUT",
          path: "/budgets/__missing_budget_id__",
          body: updatedBudget ?? {},
        };
      }
      return {
        method: "PUT",
        path: `/budgets/${budgetId}`,
        body: updatedBudget,
      };
    }
    case "delete_budget": {
      const budgetId = readString(args.budgetId);
      return {
        method: "DELETE",
        path: budgetId ? `/budgets/${budgetId}` : "/budgets/__missing_budget_id__",
        body: { expectedRevision: readNumber(args.expectedRevision, -1) },
      };
    }
    case "pause_budget": {
      const budgetId = readString(args.budgetId);
      return {
        method: "POST",
        path: budgetId ? `/budgets/${budgetId}/pause` : "/budgets/__missing_budget_id__/pause",
        body: { expectedRevision: readNumber(args.expectedRevision, -1) },
      };
    }
    case "resume_budget": {
      const budgetId = readString(args.budgetId);
      return {
        method: "POST",
        path: budgetId ? `/budgets/${budgetId}/resume` : "/budgets/__missing_budget_id__/resume",
        body: { expectedRevision: readNumber(args.expectedRevision, -1) },
      };
    }
    case "get_unread_alert_count": {
      return {
        method: "GET",
        path: "/alerts/unread-count",
      };
    }
    case "list_alerts": {
      const search = buildAlertsListSearch(args);
      return {
        method: "GET",
        path: search ? `/alerts?${search}` : "/alerts",
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
