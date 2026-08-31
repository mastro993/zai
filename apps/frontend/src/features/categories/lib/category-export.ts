import type { TransactionCategory } from "../types/model";
import { escapeCsvValue } from "@/lib/csv";

const CATEGORY_EXPORT_HEADERS = ["name", "parent_name", "color", "description", "icon"] as const;

interface CategoryExportRow {
  name: string;
  parent_name: string;
  color: string;
  description: string;
  icon: string;
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

const toCategoryExportRow = (
  category: TransactionCategory,
  categoryById: Map<string, TransactionCategory>,
): CategoryExportRow => ({
  name: category.name,
  parent_name:
    category.parent?.name ??
    (category.parentId ? categoryById.get(category.parentId)?.name : undefined) ??
    "",
  color: category.parentId ? "" : (category.color ?? ""),
  description: category.description ?? "",
  icon: category.icon ?? "",
});

export const getCategoryExportFilename = (date = new Date()) =>
  `zai_transaction_categories_${toLocalTimestamp(date)}.csv`;

export const toCategoryExportCsv = (categories: Array<TransactionCategory>) => {
  const categoryById = new Map(categories.map((category) => [category.id, category] as const));
  const rows = categories.map((category) => toCategoryExportRow(category, categoryById));

  return [
    CATEGORY_EXPORT_HEADERS.join(","),
    ...rows.map((row) =>
      CATEGORY_EXPORT_HEADERS.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ].join("\n");
};
