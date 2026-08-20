import { isoFractionDigits } from "@/lib/currency";
import { escapeCsvValue } from "@/lib/csv";
import type { TransactionCategory } from "@/features/categories/types/model";
import type { Transaction } from "../types/model";
import { formatAmountFromMinor, toBackendDateTime } from "./transaction";

export const TRANSACTION_EXPORT_VERSION = 1;
export const CONVERSION_FORMULA_VERSION = 1;

const TRANSACTION_EXPORT_HEADERS = [
  "zai_export_version",
  "date",
  "amount_minor",
  "amount",
  "currency",
  "type",
  "description",
  "notes",
  "parent_category",
  "category",
  "rate_variant",
  "rate_state",
  "rate_date",
  "source_observation_date",
  "source_currency",
  "reference_currency",
  "coefficient",
  "scale",
  "original_decimal",
  "formula_version",
  "origin",
] as const;

interface TransactionExportRow {
  zai_export_version: string;
  date: string;
  amount_minor: string;
  amount: string;
  currency: string;
  type: string;
  description: string;
  notes: string;
  parent_category: string;
  category: string;
  rate_variant: string;
  rate_state: string;
  rate_date: string;
  source_observation_date: string;
  source_currency: string;
  reference_currency: string;
  coefficient: string;
  scale: string;
  original_decimal: string;
  formula_version: string;
  origin: string;
}

const padDatePart = (value: number) => value.toString().padStart(2, "0");

const toLocalTimestamp = (date: Date) => {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());
  const second = padDatePart(date.getSeconds());

  return `${year}${month}${day}_${hour}${minute}${second}`;
};

const buildCategoryById = (categories: Array<TransactionCategory>) =>
  new Map(categories.map((category) => [category.id, category] as const));

const toCategoryExportColumns = (
  categoryId: string | null | undefined,
  categoryById: Map<string, TransactionCategory>,
): Pick<TransactionExportRow, "parent_category" | "category"> => {
  if (!categoryId) {
    return { parent_category: "", category: "" };
  }

  const category = categoryById.get(categoryId);

  if (!category) {
    return { parent_category: "", category: "" };
  }

  if (category.parentId) {
    const parentName = category.parent?.name ?? categoryById.get(category.parentId)?.name ?? "";

    return { parent_category: parentName, category: category.name };
  }

  return { parent_category: "", category: category.name };
};

const optionalNumber = (value: number | undefined) => (value === undefined ? "" : value.toString());

const toTransactionExportRow = (
  transaction: Transaction,
  categoryById: Map<string, TransactionCategory>,
): TransactionExportRow => {
  const rate = transaction.exchangeRate;
  const rateState = rate.variant === "pending" || !transaction.complete ? "pending" : "complete";

  return {
    zai_export_version: String(TRANSACTION_EXPORT_VERSION),
    date: toBackendDateTime(transaction.transactionDate),
    amount_minor: String(transaction.amount),
    amount: formatAmountFromMinor(transaction.amount, isoFractionDigits(transaction.currency)),
    currency: transaction.currency,
    type: transaction.transactionType,
    description: transaction.description ?? "",
    notes: transaction.notes ?? "",
    ...toCategoryExportColumns(transaction.transactionCategoryId, categoryById),
    rate_variant: rate.variant,
    rate_state: rateState,
    rate_date: rate.rateDate,
    source_observation_date: rate.sourceObservationDate ?? "",
    source_currency: rate.sourceCurrency,
    reference_currency: rate.referenceCurrency,
    coefficient: optionalNumber(rate.coefficient),
    scale: optionalNumber(rate.scale),
    original_decimal: rate.originalDecimal ?? "",
    formula_version: String(CONVERSION_FORMULA_VERSION),
    origin: rate.origin,
  };
};

export const getTransactionExportFilename = (date = new Date()) =>
  `zai_transactions_${toLocalTimestamp(date)}.csv`;

export const toTransactionExportCsv = (
  transactions: Array<Transaction>,
  categories: Array<TransactionCategory>,
) => {
  const categoryById = buildCategoryById(categories);
  const rows = transactions.map((transaction) => toTransactionExportRow(transaction, categoryById));

  return [
    TRANSACTION_EXPORT_HEADERS.join(","),
    ...rows.map((row) =>
      TRANSACTION_EXPORT_HEADERS.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ].join("\n");
};
