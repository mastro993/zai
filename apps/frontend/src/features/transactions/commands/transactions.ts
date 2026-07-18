import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";

import type { CategoryImportPayload } from "@/features/categories/lib/category-import";
import { toBackendDateTime } from "../lib/transaction";
import type { PaginatedTransactions, Transaction, TransactionFormValues } from "../types/model";
import { TRANSACTION_COMMANDS } from "./registry";

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
  return invokeDecodedCommand(TRANSACTION_COMMANDS.get_transactions, {
    page,
    perPage,
    filters: filters ?? null,
    sort: sort ?? null,
  });
};

export const getFilteredTransactionIds = (
  filters?: TransactionFilters,
  sort?: TransactionSort,
): CommandResult<Array<string>> => {
  return invokeDecodedCommand(TRANSACTION_COMMANDS.get_filtered_transaction_ids, {
    filters: filters ?? null,
    sort: sort ?? null,
  });
};

export type DuplicateKeyCandidate = {
  transactionDate: string;
  amount: number;
  description?: string | null;
};

export const findExistingDuplicateKeys = (
  candidates: Array<DuplicateKeyCandidate>,
): CommandResult<Array<string>> => {
  return invokeDecodedCommand(TRANSACTION_COMMANDS.find_existing_duplicate_keys, {
    request: { candidates },
  });
};

export const exportTransactionsCsv = (options?: {
  filters?: TransactionFilters;
  transactionIds?: Array<string>;
}): CommandResult<{ csv: string }> => {
  return invokeDecodedCommand(TRANSACTION_COMMANDS.export_transactions_csv, {
    request: {
      filters: options?.filters ?? null,
      transactionIds: options?.transactionIds ?? null,
    },
  });
};

export const createTransaction = (values: TransactionFormValues): CommandResult<Transaction> => {
  return invokeDecodedCommand(TRANSACTION_COMMANDS.create_transaction, {
    newTransaction: toTransactionPayload(values),
  });
};

export const updateTransaction = (
  id: string,
  values: TransactionFormValues,
): CommandResult<Transaction> => {
  return invokeDecodedCommand(TRANSACTION_COMMANDS.update_transaction, {
    updatedTransaction: {
      id,
      ...toTransactionPayload(values),
    },
  });
};

export const deleteTransaction = (transactionId: string): CommandResult<Transaction> => {
  return invokeDecodedCommand(TRANSACTION_COMMANDS.delete_transaction, {
    transactionId,
  });
};

export const deleteTransactions = (
  transactionIds: Array<string>,
): CommandResult<Array<Transaction>> => {
  return invokeDecodedCommand(TRANSACTION_COMMANDS.delete_transactions, {
    transactionIds,
  });
};

export const importTransactions = (
  transactions: Array<TransactionPayload & { id?: string }>,
): CommandResult<Array<Transaction>> => {
  return invokeDecodedCommand(TRANSACTION_COMMANDS.import_transactions, {
    transactions,
  });
};

export const importTransactionBatch = (
  categories: Array<CategoryImportPayload>,
  transactions: Array<TransactionPayload & { id?: string }>,
): CommandResult<Array<Transaction>> => {
  return invokeDecodedCommand(TRANSACTION_COMMANDS.import_transaction_batch, {
    categories,
    transactions,
  });
};
