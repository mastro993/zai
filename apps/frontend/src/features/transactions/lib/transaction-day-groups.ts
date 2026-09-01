import { format, parseISO, subDays } from "date-fns";

import { formatCurrencyFromMinor } from "@/lib/currency";

import type { TransactionListItem } from "../types/model";
import { toDateTimeInputValue } from "./transaction";
import { isTransactionType } from "./transaction-type-display";

export interface TransactionDayGroup {
  dayKey: string;
  heading: string;
  transactions: Array<TransactionListItem>;
}

const parseTransactionInstant = (transactionDate: string): Date | null => {
  const parsed = parseISO(toDateTimeInputValue(transactionDate));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export const transactionDayKey = (transactionDate: string): string => {
  const parsed = parseTransactionInstant(transactionDate);
  if (!parsed) {
    return transactionDate.slice(0, 10);
  }

  return format(parsed, "yyyy-MM-dd");
};

export const formatTransactionDayHeading = (dayKey: string, now: Date = new Date()): string => {
  const todayKey = format(now, "yyyy-MM-dd");
  const yesterdayKey = format(subDays(now, 1), "yyyy-MM-dd");

  if (dayKey === todayKey) {
    return "Today";
  }

  if (dayKey === yesterdayKey) {
    return "Yesterday";
  }

  const day = parseISO(dayKey);
  if (Number.isNaN(day.getTime())) {
    return dayKey;
  }

  return format(day, day.getFullYear() === now.getFullYear() ? "d MMMM" : "d MMMM yyyy");
};

export const formatTransactionRowDate = (transactionDate: string): string => {
  const parsed = parseTransactionInstant(transactionDate);
  if (!parsed) {
    return transactionDate;
  }

  return format(parsed, "HH:mm");
};

export const formatTransactionDayTotal = (
  transactions: Array<TransactionListItem>,
): string | null => {
  let net = 0;
  let currency: string | undefined;

  for (const transaction of transactions) {
    if (!transaction.complete || transaction.convertedAmount === null) {
      continue;
    }
    if (!isTransactionType(transaction.transactionType)) {
      continue;
    }
    if (currency !== undefined && transaction.convertedCurrency !== currency) {
      continue;
    }

    currency = transaction.convertedCurrency;
    net +=
      transaction.transactionType === "income"
        ? transaction.convertedAmount
        : -transaction.convertedAmount;
  }

  if (currency === undefined) {
    return null;
  }

  return formatCurrencyFromMinor(net, currency);
};

export const groupTransactionsByDay = (
  transactions: Array<TransactionListItem>,
  now: Date = new Date(),
): Array<TransactionDayGroup> => {
  const groups: Array<TransactionDayGroup> = [];
  const indexByDay = new Map<string, number>();

  for (const transaction of transactions) {
    const dayKey = transactionDayKey(transaction.transactionDate);
    const existingIndex = indexByDay.get(dayKey);

    if (existingIndex !== undefined) {
      groups[existingIndex]?.transactions.push(transaction);
      continue;
    }

    indexByDay.set(dayKey, groups.length);
    groups.push({
      dayKey,
      heading: formatTransactionDayHeading(dayKey, now),
      transactions: [transaction],
    });
  }

  return groups;
};
