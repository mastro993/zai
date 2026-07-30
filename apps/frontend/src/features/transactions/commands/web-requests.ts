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
  transactionDate: string;
  transactionType: string;
  transactionCategoryId?: string | null;
  notes?: string | null;
}

export interface DuplicateKeyCandidate {
  transactionDate: string;
  amount: number;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isStringArray = (value: unknown): value is Array<string> =>
  Array.isArray(value) && value.every(isNonEmptyString);

const parseFilters = (
  value: unknown,
): Result.Result<TransactionFilters | null | undefined, CommandError> => {
  if (value === undefined || value === null) {
    return Result.succeed(value);
  }
  if (!isRecord(value)) {
    return Result.fail(new CommandError("Transaction filters must be a record or null"));
  }
  for (const key of ["query", "transactionType", "startDate", "endDate"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      return Result.fail(new CommandError(`Transaction filter ${key} must be a string`));
    }
  }
  if (value.categories !== undefined && !isStringArray(value.categories)) {
    return Result.fail(new CommandError("Transaction categories must be an array of strings"));
  }
  return Result.succeed(value as TransactionFilters);
};

const parseSort = (
  value: unknown,
): Result.Result<TransactionSort | null | undefined, CommandError> => {
  if (value === undefined || value === null) {
    return Result.succeed(value);
  }
  if (!isRecord(value) || !isNonEmptyString(value.field) || typeof value.desc !== "boolean") {
    return Result.fail(
      new CommandError("Transaction sort must contain a field and boolean direction"),
    );
  }
  return Result.succeed(value as unknown as TransactionSort);
};

const parsePagination = (
  page: unknown,
  perPage: unknown,
): Result.Result<{ page: number; perPage: number }, CommandError> => {
  const validPage = page === undefined ? 1 : page;
  const validPerPage = perPage === undefined ? 50 : perPage;
  if (
    typeof validPage !== "number" ||
    !Number.isInteger(validPage) ||
    validPage < 1 ||
    typeof validPerPage !== "number" ||
    !Number.isInteger(validPerPage) ||
    validPerPage < 1
  ) {
    return Result.fail(new CommandError("Transaction pagination must use positive integers"));
  }
  return Result.succeed({ page: validPage, perPage: validPerPage });
};

const flattenFilters = (
  filters: TransactionFilters | null | undefined,
): Record<string, unknown> => {
  if (!filters) {
    return {};
  }
  const body: Record<string, unknown> = {};
  if (filters.query) body.query = filters.query;
  if (filters.transactionType) body.transactionType = filters.transactionType;
  if (filters.startDate) body.startDate = filters.startDate;
  if (filters.endDate) body.endDate = filters.endDate;
  if (filters.categories) {
    body[filters.categories.length === 0 ? "uncategorized" : "categories"] =
      filters.categories.length === 0 ? "true" : filters.categories;
  }
  return body;
};

const addFilterQuery = (
  params: URLSearchParams,
  filters: TransactionFilters | null | undefined,
): void => {
  const flatFilters = flattenFilters(filters);
  for (const [key, value] of Object.entries(flatFilters)) {
    if (key === "categories" && Array.isArray(value)) {
      for (const categoryId of value) {
        params.append("categoryId", categoryId);
      }
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }
};

const queryFromParams = (params: URLSearchParams): Record<string, string | Array<string>> => {
  const query: Record<string, string | Array<string>> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  return query;
};

const parseSortAndFilters = (
  filters: unknown,
  sort: unknown,
): Result.Result<
  { filters: TransactionFilters | null | undefined; sort: TransactionSort | null | undefined },
  CommandError
> => {
  const validFilters = parseFilters(filters);
  if (Result.isFailure(validFilters)) return validFilters;
  const validSort = parseSort(sort);
  if (Result.isFailure(validSort)) return validSort;
  return Result.succeed({ filters: validFilters.value, sort: validSort.value });
};

export const buildGetTransactionsRequest = (
  args: GetTransactionsArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args)) {
    return Result.fail(new CommandError("Transaction list arguments must be a record"));
  }
  const pagination = parsePagination(args.page, args.perPage);
  if (Result.isFailure(pagination)) return pagination;
  const parsed = parseSortAndFilters(args.filters, args.sort);
  if (Result.isFailure(parsed)) return parsed;
  const params = new URLSearchParams();
  params.set("page", String(pagination.value.page));
  params.set("perPage", String(pagination.value.perPage));
  addFilterQuery(params, parsed.value.filters);
  if (parsed.value.sort) {
    params.set("sortField", parsed.value.sort.field);
    params.set("sortDesc", String(parsed.value.sort.desc));
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
  if (!isRecord(args)) {
    return Result.fail(new CommandError("Filtered transaction arguments must be a record"));
  }
  const parsed = parseSortAndFilters(args.filters, args.sort);
  if (Result.isFailure(parsed)) return parsed;
  return Result.succeed({
    method: "POST",
    path: "/transactions/ids",
    body: {
      ...flattenFilters(parsed.value.filters),
      ...(parsed.value.sort
        ? { sortField: parsed.value.sort.field, sortDesc: parsed.value.sort.desc }
        : {}),
    },
  });
};

export const buildExportTransactionsRequest = (
  args: ExportTransactionsArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !isRecord(args.request)) {
    return Result.fail(new CommandError("Transaction export requires a request record"));
  }
  const parsedFilters = parseFilters(args.request.filters);
  if (Result.isFailure(parsedFilters)) return parsedFilters;
  if (
    args.request.transactionIds !== undefined &&
    args.request.transactionIds !== null &&
    !isStringArray(args.request.transactionIds)
  ) {
    return Result.fail(new CommandError("Transaction export ids must be an array of strings"));
  }
  return Result.succeed({
    method: "POST",
    path: "/transactions/export",
    body: {
      ...flattenFilters(parsedFilters.value),
      ...(args.request.transactionIds ? { transactionIds: args.request.transactionIds } : {}),
    },
  });
};

export const buildFindDuplicateKeysRequest = (
  args: FindDuplicateKeysArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !isRecord(args.request) || !Array.isArray(args.request.candidates)) {
    return Result.fail(new CommandError("Duplicate lookup requires candidates"));
  }
  return Result.succeed({
    method: "POST",
    path: "/transactions/duplicate-keys",
    body: { candidates: args.request.candidates },
  });
};

export const buildGetTransactionRequest = (
  args: TransactionIdentifierArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !isNonEmptyString(args.transactionId)) {
    return Result.fail(new CommandError("Transaction id must be a non-empty string"));
  }
  return Result.succeed({
    method: "GET",
    path: `/transactions/${args.transactionId}`,
  });
};

const validTransactionPayload = (value: unknown): value is TransactionPayload =>
  isRecord(value) &&
  typeof value.amount === "number" &&
  Number.isInteger(value.amount) &&
  isNonEmptyString(value.transactionDate) &&
  isNonEmptyString(value.transactionType);

export const buildCreateTransactionRequest = (
  args: CreateTransactionArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !validTransactionPayload(args.newTransaction)) {
    return Result.fail(new CommandError("Transaction payload must be a valid record"));
  }
  return Result.succeed({
    method: "POST",
    path: "/transactions",
    body: args.newTransaction,
  });
};

export const buildUpdateTransactionRequest = (
  args: UpdateTransactionArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (
    !isRecord(args) ||
    !validTransactionPayload(args.updatedTransaction) ||
    !isNonEmptyString(args.updatedTransaction.id)
  ) {
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
  if (!isRecord(args) || !isNonEmptyString(args.transactionId)) {
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
  if (!isRecord(args) || !isStringArray(args.transactionIds) || args.transactionIds.length === 0) {
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
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !Array.isArray(args.transactions)) {
    return Result.fail(new CommandError("Transaction import requires transactions"));
  }
  return Result.succeed({
    method: "POST",
    path: "/transactions/import",
    body: { transactions: args.transactions },
  });
};

export const buildImportTransactionBatchRequest = (
  args: ImportTransactionBatchArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !Array.isArray(args.categories) || !Array.isArray(args.transactions)) {
    return Result.fail(
      new CommandError("Transaction batch import requires categories and transactions"),
    );
  }
  return Result.succeed({
    method: "POST",
    path: "/transactions/import-batch",
    body: { categories: args.categories, transactions: args.transactions },
  });
};
