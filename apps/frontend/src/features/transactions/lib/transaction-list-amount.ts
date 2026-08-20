import { formatCurrencyFromMinor } from "@/lib/currency";

import type { TransactionListItem } from "../types/model";

export const transactionListAmountParts = (
  transaction: Pick<
    TransactionListItem,
    "amount" | "currency" | "convertedAmount" | "convertedCurrency" | "complete"
  >,
) => {
  const display =
    transaction.complete && transaction.convertedAmount !== null
      ? formatCurrencyFromMinor(transaction.convertedAmount, transaction.convertedCurrency)
      : "Incomplete";
  const original =
    transaction.currency === transaction.convertedCurrency
      ? null
      : formatCurrencyFromMinor(transaction.amount, transaction.currency);

  return { original, display };
};
