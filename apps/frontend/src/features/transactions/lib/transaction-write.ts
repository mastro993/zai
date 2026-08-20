import { parseISO } from "date-fns";

import { isoFractionDigits, localizeDecimalString } from "@/lib/currency";
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

const CONVERSION_RATE_DISPLAY_SCALE = 6;

const trimTrailingFractionalZeros = (value: string) =>
  value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;

const roundDecimalToScale = (value: string, scale: number) => {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    return value;
  }

  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length <= scale) {
    return trimTrailingFractionalZeros(value);
  }

  const keep = fraction.slice(0, scale);
  if ((fraction[scale] ?? "0") < "5") {
    return trimTrailingFractionalZeros(`${whole}.${keep}`);
  }

  const digits = [...whole, ...keep];
  let index = digits.length - 1;
  while (index >= 0) {
    const current = digits[index] ?? "0";
    if (current !== "9") {
      digits[index] = String(Number(current) + 1);
      break;
    }
    digits[index] = "0";
    index -= 1;
  }
  if (index < 0) {
    digits.unshift("1");
  }

  const wholeLength = digits.length - scale;
  return trimTrailingFractionalZeros(
    `${digits.slice(0, wholeLength).join("")}.${digits.slice(wholeLength).join("")}`,
  );
};

export const formatConversionRateDisplay = (rate: string) =>
  localizeDecimalString(roundDecimalToScale(rate.trim(), CONVERSION_RATE_DISPLAY_SCALE));

export const formatConversionRatePlaceholder = (
  sourceCurrency: string,
  targetCurrency: string,
  rate: string,
  rateDate: string,
) => {
  const parsed = parseISO(rateDate);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? rateDate
    : new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(parsed);

  return `1 ${sourceCurrency} = ${formatConversionRateDisplay(rate)} ${targetCurrency} on ${dateLabel}`;
};

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
