import { formatAmountFromMinor, toBackendDateTime } from "./transaction";
import { escapeCsvValue } from "@/lib/csv";
import type { Transaction } from "../types/model";
import type { TransactionCategory } from "@/features/categories/types/model";

const TRANSACTION_EXPORT_HEADERS = [
  "date",
  "amount",
  "type",
  "description",
  "notes",
  "parent_category",
  "category",
] as const;

type TransactionExportHeader = (typeof TRANSACTION_EXPORT_HEADERS)[number];
type TransactionExportRow = Record<TransactionExportHeader, string>;

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

const toTransactionExportRow = (
  transaction: Transaction,
  categoryById: Map<string, TransactionCategory>,
): TransactionExportRow => ({
  date: toBackendDateTime(transaction.transactionDate),
  amount: formatAmountFromMinor(transaction.amount),
  type: transaction.transactionType,
  description: transaction.description ?? "",
  notes: transaction.notes ?? "",
  ...toCategoryExportColumns(transaction.transactionCategoryId, categoryById),
});

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
