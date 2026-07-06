import type {
  PaginatedTransactions,
  Transaction,
  TransactionFormValues,
} from "@/features/cash-flow/model";
import { toBackendDateTime } from "@/features/cash-flow/model";
import { type CommandResult, invokeCommand } from "@/commands/shared";

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
