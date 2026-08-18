import type { TransactionImportColumnMapping } from "./transaction-import-types";

export const LEGACY_EXPORT_HEADERS = "date,amount,type,description,notes,parent_category,category";
export const ZAI_EXPORT_VERSION_HEADER = "zai_export_version";

const emptyMapping: TransactionImportColumnMapping = {
  amount: null,
  amountMinor: null,
  currency: null,
  transactionDate: null,
  transactionType: null,
  description: null,
  notes: null,
  categoryName: null,
  categoryParent: null,
  rate: null,
  rateDate: null,
};

const DEFAULT_EXPENSE_TYPE_VALUES = "expense, debit, out";
const DEFAULT_INCOME_TYPE_VALUES = "income, credit, in";

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

export const isZaiTransactionExport = (headers: Array<string>) =>
  headers.some((header) => header.trim().toLowerCase() === ZAI_EXPORT_VERSION_HEADER);

export const isLegacySevenColumnExport = (headers: Array<string>) =>
  headers.map((header) => header.trim().toLowerCase()).join(",") === LEGACY_EXPORT_HEADERS;

export const inferTransactionImportMapping = (
  headers: Array<string>,
): TransactionImportColumnMapping => {
  const categoryName = findHeaderIndex(headers, ["category", "category_name", "name"]);
  const description =
    findHeaderIndex(headers, ["description", "memo", "payee"]) ??
    findHeaderIndexExcluding(headers, ["name"], categoryName);

  return {
    amount: findHeaderIndex(headers, ["amount", "value", "sum"]),
    amountMinor: findHeaderIndex(headers, ["amount_minor"]),
    currency: findHeaderIndex(headers, ["currency", "ccy", "iso_code"]),
    transactionDate: findHeaderIndex(headers, ["date", "transaction_date", "posted"]),
    transactionType: findHeaderIndex(headers, ["type", "transaction_type", "kind"]),
    description,
    notes: findHeaderIndex(headers, ["notes", "note", "comment"]),
    categoryName,
    categoryParent: findHeaderIndex(headers, ["parent_category", "parent_name", "parent"]),
    rate: findHeaderIndex(headers, ["rate", "exchange_rate", "fx_rate"]),
    rateDate: findHeaderIndex(headers, ["rate_date", "fx_date"]),
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
