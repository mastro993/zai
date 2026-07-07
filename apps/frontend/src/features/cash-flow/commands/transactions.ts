import { R } from "@praha/byethrow";

import { type CommandResult, invokeCommand } from "@/commands/shared";

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

type TransactionFilters = {
  query?: string;
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
): Promise<CommandResult<Array<Transaction>>> => {
  const firstResult = await getTransactions(1, IMPORT_DEDUP_PAGE_SIZE, filters);

  if (R.isFailure(firstResult)) {
    return firstResult;
  }

  const allTransactions = [...firstResult.value.data];

  for (let page = 2; page <= firstResult.value.totalPages; page += 1) {
    const pageResult = await getTransactions(page, firstResult.value.perPage, filters);

    if (R.isFailure(pageResult)) {
      return pageResult;
    }

    allTransactions.push(...pageResult.value.data);
  }

  return R.succeed(allTransactions);
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
