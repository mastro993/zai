import type { TransactionImportColumnMapping } from "./transaction-import-types";
import {
  DEFAULT_EXPENSE_TYPE_VALUES,
  DEFAULT_INCOME_TYPE_VALUES,
} from "./transaction-import-type-resolution";

export const emptyMapping: TransactionImportColumnMapping = {
  amount: null,
  transactionDate: null,
  transactionType: null,
  description: null,
  notes: null,
  categoryName: null,
  categoryParent: null,
};

export const isRowEmpty = (row: Array<string>) => row.every((value) => value.trim() === "");

export const getCell = (row: Array<string>, column: number | null) =>
  column === null ? "" : (row[column] ?? "");

const findHeaderIndex = (headers: Array<string>, names: Array<string>) => {
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
  const index = headers.findIndex((header) => normalizedNames.has(header.trim().toLowerCase()));

  return index === -1 ? null : index;
};

const findHeaderIndexExcluding = (
  headers: Array<string>,
  names: Array<string>,
  excludedIndex: number | null,
) => {
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
  const index = headers.findIndex(
    (header, headerIndex) =>
      headerIndex !== excludedIndex && normalizedNames.has(header.trim().toLowerCase()),
  );

  return index === -1 ? null : index;
};

export const inferTransactionImportMapping = (
  headers: Array<string>,
): TransactionImportColumnMapping => {
  const categoryName = findHeaderIndex(headers, ["category", "category_name", "name"]);
  const description =
    findHeaderIndex(headers, ["description", "memo", "payee"]) ??
    findHeaderIndexExcluding(headers, ["name"], categoryName);

  return {
    amount: findHeaderIndex(headers, ["amount", "value", "sum"]),
    transactionDate: findHeaderIndex(headers, ["date", "transaction_date", "posted"]),
    transactionType: findHeaderIndex(headers, ["type", "transaction_type", "kind"]),
    description,
    notes: findHeaderIndex(headers, ["notes", "note", "comment"]),
    categoryName,
    categoryParent: findHeaderIndex(headers, ["parent_category", "parent_name", "parent"]),
  };
};

export const getDefaultTransactionImportMapping = (headers: Array<string>) => ({
  ...emptyMapping,
  ...inferTransactionImportMapping(headers),
});

export const getDefaultTypeValueInputs = () => ({
  expenseTypeValues: DEFAULT_EXPENSE_TYPE_VALUES,
  incomeTypeValues: DEFAULT_INCOME_TYPE_VALUES,
});
