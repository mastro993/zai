import type { TransactionType } from "../types/model";

export const TRANSACTION_TYPE_DISPLAY = {
  income: {
    label: "Income",
    badgeVariant: "default",
  },
  expense: {
    label: "Expense",
    badgeVariant: "destructive",
  },
} as const satisfies Record<
  TransactionType,
  { label: string; badgeVariant: "default" | "destructive" }
>;

export const isTransactionType = (value: string): value is TransactionType =>
  value === "income" || value === "expense";

export const formatTransactionTypeLabel = (type: TransactionType): string =>
  TRANSACTION_TYPE_DISPLAY[type].label;
