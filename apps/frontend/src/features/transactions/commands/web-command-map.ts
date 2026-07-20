import { CommandError } from "@/commands/errors";
import { flattenTransactionFiltersBody } from "@/commands/transaction-filter-body";
import type { CommandArgs } from "@/commands/types";
import {
  omitId,
  readNumber,
  readRecord,
  readString,
  readStringArray,
} from "@/commands/web-request-args";
import type { WebRequestSpec } from "@/commands/web-request-spec";

export const buildTransactionsListQuery = (args: CommandArgs = {}): string => {
  const params = new URLSearchParams();
  params.set("page", String(readNumber(args.page, 1)));
  params.set("perPage", String(readNumber(args.perPage, 50)));

  const filters = readRecord(args.filters);
  const flatFilters = flattenTransactionFiltersBody(filters);
  for (const [key, value] of Object.entries(flatFilters)) {
    if (key === "categories" && Array.isArray(value)) {
      for (const categoryId of value) {
        if (typeof categoryId === "string") {
          params.append("categoryId", categoryId);
        }
      }
      continue;
    }
    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const sort = readRecord(args.sort);
  if (sort?.field && typeof sort.field === "string") {
    params.set("sortField", sort.field);
    params.set("sortDesc", String(sort.desc === true));
  }

  return params.toString();
};

export const buildTransactionCommandRequestSpec = (
  command: string,
  args: CommandArgs = {},
): WebRequestSpec | undefined => {
  switch (command) {
    case "get_transactions": {
      const search = buildTransactionsListQuery(args);
      return {
        method: "GET",
        path: search ? `/transactions?${search}` : "/transactions",
      };
    }
    case "get_filtered_transaction_ids": {
      const filters = flattenTransactionFiltersBody(readRecord(args.filters));
      const sort = readRecord(args.sort);
      return {
        method: "POST",
        path: "/transactions/ids",
        body: {
          ...filters,
          ...(sort?.field && typeof sort.field === "string"
            ? { sortField: sort.field, sortDesc: sort.desc === true }
            : {}),
        },
      };
    }
    case "export_transactions_csv": {
      const request = readRecord(args.request) ?? args;
      const filters = flattenTransactionFiltersBody(readRecord(request.filters));
      const transactionIds = readStringArray(request.transactionIds);
      return {
        method: "POST",
        path: "/transactions/export",
        body: {
          ...filters,
          ...(transactionIds ? { transactionIds } : {}),
        },
      };
    }
    case "find_existing_duplicate_keys": {
      const request = readRecord(args.request) ?? args;
      const candidates = request.candidates;
      if (!Array.isArray(candidates)) {
        throw new CommandError("find_existing_duplicate_keys requires candidates");
      }
      return {
        method: "POST",
        path: "/transactions/duplicate-keys",
        body: { candidates },
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
    default:
      return undefined;
  }
};
