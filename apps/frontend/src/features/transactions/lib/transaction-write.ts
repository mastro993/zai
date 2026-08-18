import { isoFractionDigits } from "@/lib/currency";
import type { Transaction, TransactionFormValues } from "../types/model";
import { toDateTimeInputValue } from "./transaction";

export const formValuesFromTransaction = (transaction: Transaction): TransactionFormValues => ({
  description: transaction.description ?? undefined,
  amount: transaction.amount,
  currency: transaction.currency,
  transactionDate: toDateTimeInputValue(transaction.transactionDate),
  transactionType:
    transaction.transactionType === "income" || transaction.transactionType === "expense"
      ? transaction.transactionType
      : "expense",
  transactionCategoryId: transaction.transactionCategoryId ?? "",
  notes: transaction.notes ?? undefined,
  manualExchangeRate: undefined,
});

export const quoteDateFromInput = (transactionDate: string) => transactionDate.slice(0, 10);

export const convertedMinorFromRate = (
  sourceMinor: number,
  sourceCurrency: string,
  targetCurrency: string,
  rate: string,
) => {
  const parsedRate = Number(rate);
  if (!Number.isFinite(parsedRate)) {
    return null;
  }

  const sourceMajor = sourceMinor / 10 ** isoFractionDigits(sourceCurrency);
  return Math.round(sourceMajor * parsedRate * 10 ** isoFractionDigits(targetCurrency));
};
