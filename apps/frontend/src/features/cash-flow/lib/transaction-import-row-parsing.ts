import type { TransactionCategory, TransactionType } from "../types/model";
import type {
  TransactionImportCategoryLinkMode,
  TransactionImportColumnMapping,
} from "./transaction-import-types";

export interface ParsedCategoryPath {
  parentName: string;
  name: string;
  isChild: boolean;
}

export const createFallbackId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `transaction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const normalizeName = (value: string) => value.trim();
export const categoryKey = (value: string) => normalizeName(value).toLowerCase();
export const childPathKey = (parentName: string, childName: string) =>
  `${categoryKey(parentName)}\u0000${categoryKey(childName)}`;
export const isRowEmpty = (row: Array<string>) => row.every((value) => value.trim() === "");
export const getCell = (row: Array<string>, column: number | null) =>
  column === null ? "" : (row[column] ?? "");

export const parseTypeValueList = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

export const resolveTypeFromColumn = (
  raw: string,
  expenseValues: Array<string>,
  incomeValues: Array<string>,
): { ok: true; value: TransactionType } | { ok: false; message: string } => {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, message: "Transaction type is required" };
  }
  if (expenseValues.includes(normalized)) {
    return { ok: true, value: "expense" };
  }
  if (incomeValues.includes(normalized)) {
    return { ok: true, value: "income" };
  }
  return { ok: false, message: "Unmapped transaction type value" };
};

export const transactionDuplicateKey = (
  transactionDate: string,
  amount: number,
  description: string,
) => `${transactionDate.slice(0, 10)}\u0000${amount}\u0000${description.trim().toLowerCase()}`;

export const formatCategoryDisplay = (parsed: ParsedCategoryPath | null) => {
  if (!parsed?.name) {
    return "";
  }
  return parsed.isChild ? `${parsed.parentName} > ${parsed.name}` : parsed.name;
};

export const parseCategoryPath = (
  row: Array<string>,
  mapping: TransactionImportColumnMapping,
  linkMode: TransactionImportCategoryLinkMode,
  separator: string,
): ParsedCategoryPath | null => {
  if (mapping.categoryName === null) {
    return null;
  }

  const rawName = getCell(row, mapping.categoryName);
  if (!normalizeName(rawName)) {
    return null;
  }

  if (linkMode === "single-column") {
    const separatorIndex = separator ? rawName.indexOf(separator) : -1;
    if (separatorIndex === -1) {
      return { parentName: "", name: normalizeName(rawName), isChild: false };
    }
    return {
      parentName: normalizeName(rawName.slice(0, separatorIndex)),
      name: normalizeName(rawName.slice(separatorIndex + separator.length)),
      isChild: true,
    };
  }

  const parentName = normalizeName(getCell(row, mapping.categoryParent));
  return {
    parentName,
    name: normalizeName(rawName),
    isChild: parentName !== "",
  };
};

export const buildCategoryLookups = (categories: Array<TransactionCategory>) => {
  const categoryById = new Map(categories.map((category) => [category.id, category] as const));
  const rootIdByKey = new Map<string, string>();
  const childIdByPath = new Map<string, string>();

  for (const category of categories) {
    if (!category.parentId) {
      rootIdByKey.set(categoryKey(category.name), category.id);
      continue;
    }
    const parent = category.parent ?? categoryById.get(category.parentId);
    if (parent) {
      childIdByPath.set(childPathKey(parent.name, category.name), category.id);
    }
  }

  return { rootIdByKey, childIdByPath };
};
