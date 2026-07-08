import { Result } from "@praha/byethrow";

import { type CommandResult, invokeCommand } from "@/commands/shared";

import type { CategoryImportPayload } from "../lib/category-import";
import { toBackendDateTime } from "../lib/transaction";
import type { PaginatedTransactions, Transaction, TransactionFormValues } from "../types/model";

type TransactionPayload = {
  description?: string | null;
  amount: number;
  transactionDate: string;
  transactionType: string;
  transactionCategoryId?: string | null;
  notes?: string | null;
};

export type TransactionFilters = {
  query?: string;
  /**
   * Omitted means no category filter. An empty array means uncategorized only
   * (transactions with no category). A non-empty array filters to those categories.
   */
  categories?: Array<string>;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
};

type TransactionSort = {
  field: string;
  desc: boolean;
};

const toTransactionPayload = (values: TransactionFormValues): TransactionPayload => ({
  description: values.description || null,
  amount: values.amount,
  transactionDate: toBackendDateTime(values.transactionDate),
  transactionType: values.transactionType,
  transactionCategoryId: values.transactionCategoryId || null,
  notes: values.notes || null,
});

export const getTransactions = (
  page = 1,
  perPage = 50,
  filters?: TransactionFilters,
  sort?: TransactionSort,
): CommandResult<PaginatedTransactions> => {
  return invokeCommand<PaginatedTransactions>("get_transactions", {
    page,
    perPage,
    filters: filters ?? null,
    sort: sort ?? null,
  });
};

const IMPORT_DEDUP_PAGE_SIZE = 500;

export const getAllTransactions = async (
  filters?: TransactionFilters,
): CommandResult<Array<Transaction>> => {
  const firstResult = await getTransactions(1, IMPORT_DEDUP_PAGE_SIZE, filters);

  if (Result.isFailure(firstResult)) {
    return firstResult;
  }

  const allTransactions = [...firstResult.value.data];

  if (firstResult.value.totalPages > 1) {
    const pageResults = await Promise.all(
      Array.from({ length: firstResult.value.totalPages - 1 }, (_, index) =>
        getTransactions(index + 2, firstResult.value.perPage, filters),
      ),
    );

    for (const pageResult of pageResults) {
      if (Result.isFailure(pageResult)) {
        return pageResult;
      }

      allTransactions.push(...pageResult.value.data);
    }
  }

  return Result.succeed(allTransactions);
};

export const createTransaction = (values: TransactionFormValues): CommandResult<Transaction> => {
  return invokeCommand<Transaction>("create_transaction", {
    newTransaction: toTransactionPayload(values),
  });
};

export const updateTransaction = (
  id: string,
  values: TransactionFormValues,
): CommandResult<Transaction> => {
  return invokeCommand<Transaction>("update_transaction", {
    updatedTransaction: {
      id,
      ...toTransactionPayload(values),
    },
  });
};

export const deleteTransaction = (transactionId: string): CommandResult<Transaction> => {
  return invokeCommand<Transaction>("delete_transaction", {
    transactionId,
  });
};

export const importTransactions = (
  transactions: Array<TransactionPayload & { id?: string }>,
): CommandResult<Array<Transaction>> => {
  return invokeCommand<Array<Transaction>>("import_transactions", {
    transactions,
  });
};

export const importTransactionBatch = (
  categories: Array<CategoryImportPayload>,
  transactions: Array<TransactionPayload & { id?: string }>,
): CommandResult<Array<Transaction>> => {
  return invokeCommand<Array<Transaction>>("import_transaction_batch", {
    categories,
    transactions,
  });
};
