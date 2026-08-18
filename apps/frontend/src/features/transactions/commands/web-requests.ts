import { Result } from "@praha/byethrow";

import { CommandError } from "@/commands/errors";
import type { WebRequestSpec } from "@/commands/web-request-spec";
import type { CategoryBackendImportPayload } from "@/features/categories/lib/category-import";

export interface TransactionFilters {
  query?: string;
  categories?: Array<string>;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
}

export interface TransactionSort {
  field: string;
  desc: boolean;
}

export interface TransactionPayload {
  description?: string | null;
  amount: number;
  currency: string;
  transactionDate: string;
  transactionType: string;
  transactionCategoryId?: string | null;
  notes?: string | null;
  manualExchangeRate?: string;
  confirmManualRateReplacement?: boolean;
  retryRateLookup?: boolean;
}

export interface DuplicateKeyCandidate {
  transactionDate: string;
  amount: number;
  currency: string;
  description?: string | null;
}

export interface GetTransactionsArgs {
  page?: number;
  perPage?: number;
  filters?: TransactionFilters | null;
  sort?: TransactionSort | null;
}

export interface GetFilteredTransactionIdsArgs {
  filters?: TransactionFilters | null;
  sort?: TransactionSort | null;
}

export interface FindDuplicateKeysArgs {
  request: { candidates: Array<DuplicateKeyCandidate> };
}

export interface ExportTransactionsArgs {
  request: { filters?: TransactionFilters | null; transactionIds?: Array<string> | null };
}

export interface CreateTransactionArgs {
  newTransaction: TransactionPayload;
}

export interface UpdateTransactionArgs {
  updatedTransaction: TransactionPayload & { id: string };
}

export interface TransactionIdentifierArgs {
  transactionId: string;
}

export interface DeleteTransactionsArgs {
  transactionIds: Array<string>;
}

export interface ImportTransactionsArgs {
  transactions: Array<TransactionPayload & { id?: string }>;
}

export interface ImportTransactionBatchArgs {
  categories: Array<CategoryBackendImportPayload>;
  transactions: Array<TransactionPayload & { id?: string }>;
}

interface FlatTransactionFilters {
  query?: string;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
  categories?: Array<string>;
  uncategorized?: string;
}

interface FilteredTransactionIdsBody extends FlatTransactionFilters {
  sortField?: string;
  sortDesc?: boolean;
}

interface ExportTransactionsBody extends FlatTransactionFilters {
  transactionIds?: Array<string>;
}

const isNonEmptyString = (value: string): boolean => value.length > 0;

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

const parsePagination = (
  page: number | undefined,
  perPage: number | undefined,
): Result.Result<{ page: number; perPage: number }, CommandError> => {
  const validPage = page === undefined ? 1 : page;
  const validPerPage = perPage === undefined ? 50 : perPage;
  if (!isPositiveInteger(validPage) || !isPositiveInteger(validPerPage)) {
    return Result.fail(new CommandError("Transaction pagination must use positive integers"));
  }
  return Result.succeed({ page: validPage, perPage: validPerPage });
};

const flattenFilters = (filters: TransactionFilters | null | undefined): FlatTransactionFilters => {
  const body: FlatTransactionFilters = {};
  if (!filters) {
    return body;
  }
  if (filters.query) body.query = filters.query;
  if (filters.transactionType) body.transactionType = filters.transactionType;
  if (filters.startDate) body.startDate = filters.startDate;
  if (filters.endDate) body.endDate = filters.endDate;
  if (filters.categories) {
    if (filters.categories.length === 0) {
      body.uncategorized = "true";
    } else {
      body.categories = filters.categories;
    }
  }
  return body;
};

const addFilterQuery = (
  params: URLSearchParams,
  filters: TransactionFilters | null | undefined,
): void => {
  const flatFilters = flattenFilters(filters);
  if (flatFilters.categories) {
    for (const categoryId of flatFilters.categories) {
      params.append("categoryId", categoryId);
    }
  }
  if (flatFilters.query) params.set("query", flatFilters.query);
  if (flatFilters.transactionType) params.set("transactionType", flatFilters.transactionType);
  if (flatFilters.startDate) params.set("startDate", flatFilters.startDate);
  if (flatFilters.endDate) params.set("endDate", flatFilters.endDate);
  if (flatFilters.uncategorized) params.set("uncategorized", flatFilters.uncategorized);
};

const queryFromParams = (params: URLSearchParams) => {
  const query: Record<string, string | Array<string>> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  return query;
};

export const buildGetTransactionsRequest = (
  args: GetTransactionsArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const pagination = parsePagination(args.page, args.perPage);
  if (Result.isFailure(pagination)) return pagination;
  const params = new URLSearchParams();
  params.set("page", String(pagination.value.page));
  params.set("perPage", String(pagination.value.perPage));
  addFilterQuery(params, args.filters);
  if (args.sort) {
    params.set("sortField", args.sort.field);
    params.set("sortDesc", String(args.sort.desc));
  }
  return Result.succeed({
    method: "GET",
    path: "/transactions",
    query: queryFromParams(params),
  });
};

export const buildGetFilteredTransactionIdsRequest = (
  args: GetFilteredTransactionIdsArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const body: FilteredTransactionIdsBody = flattenFilters(args.filters);
  if (args.sort) {
    body.sortField = args.sort.field;
    body.sortDesc = args.sort.desc;
  }
  return Result.succeed({
    method: "POST",
    path: "/transactions/ids",
    body,
  });
};

export const buildExportTransactionsRequest = (
  args: ExportTransactionsArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const body: ExportTransactionsBody = flattenFilters(args.request.filters);
  if (args.request.transactionIds) {
    body.transactionIds = args.request.transactionIds;
  }
  return Result.succeed({
    method: "POST",
    path: "/transactions/export",
    body,
  });
};

export const buildFindDuplicateKeysRequest = (
  args: FindDuplicateKeysArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({
    method: "POST",
    path: "/transactions/duplicate-keys",
    body: { candidates: args.request.candidates },
  });

export const buildGetTransactionRequest = (
  args: TransactionIdentifierArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.transactionId)) {
    return Result.fail(new CommandError("Transaction id must be a non-empty string"));
  }
  return Result.succeed({
    method: "GET",
    path: `/transactions/${args.transactionId}`,
  });
};

export const buildCreateTransactionRequest = (
  args: CreateTransactionArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({
    method: "POST",
    path: "/transactions",
    body: args.newTransaction,
  });

export const buildUpdateTransactionRequest = (
  args: UpdateTransactionArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.updatedTransaction.id)) {
    return Result.fail(new CommandError("Transaction update requires a valid id and payload"));
  }
  const { id: _id, ...body } = args.updatedTransaction;
  return Result.succeed({
    method: "PUT",
    path: `/transactions/${args.updatedTransaction.id}`,
    body,
  });
};

export const buildDeleteTransactionRequest = (
  args: TransactionIdentifierArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.transactionId)) {
    return Result.fail(new CommandError("Transaction id must be a non-empty string"));
  }
  return Result.succeed({
    method: "DELETE",
    path: `/transactions/${args.transactionId}`,
  });
};

export const buildDeleteTransactionsRequest = (
  args: DeleteTransactionsArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (args.transactionIds.length === 0 || !args.transactionIds.every(isNonEmptyString)) {
    return Result.fail(new CommandError("Transaction deletion requires ids"));
  }
  return Result.succeed({
    method: "POST",
    path: "/transactions/bulk-delete",
    body: { transactionIds: args.transactionIds },
  });
};

export const buildImportTransactionsRequest = (
  args: ImportTransactionsArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({
    method: "POST",
    path: "/transactions/import",
    body: { transactions: args.transactions },
  });

export const buildImportTransactionBatchRequest = (
  args: ImportTransactionBatchArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({
    method: "POST",
    path: "/transactions/import-batch",
    body: { categories: args.categories, transactions: args.transactions },
  });
