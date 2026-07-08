import { parseCategoryCsv } from "./category-csv";
import type { CategoryImportPayload } from "./category-import";
import { parseImportAmount } from "./parse-import-amount";
import type { Transaction, TransactionCategory, TransactionType } from "../types/model";

export { parseCategoryCsv as parseTransactionCsv } from "./category-csv";
export { parseImportAmount } from "./parse-import-amount";

export type TransactionImportAmountMode = "signed" | "column-type";
export type TransactionImportCategoryLinkMode = "columns" | "single-column";
export type TransactionImportMissingCategoryMode = "uncategorized" | "create";
export type TransactionImportPreviewStatus = "import" | "duplicate" | "invalid" | "empty";
export type TransactionImportDateFormat =
  | "ISO"
  | "YYYY-MM-DD"
  | "DD/MM/YYYY"
  | "MM/DD/YYYY"
  | "DD-MM-YYYY"
  | "DD.MM.YYYY";

export type TransactionImportColumnMapping = {
  amount: number | null;
  transactionDate: number | null;
  transactionType: number | null;
  description: number | null;
  notes: number | null;
  categoryName: number | null;
  categoryParent: number | null;
};

export type TransactionImportPayload = {
  id?: string;
  description?: string | null;
  amount: number;
  transactionDate: string;
  transactionType: string;
  transactionCategoryId?: string | null;
  notes?: string | null;
};

export type TransactionImportPreviewRow = {
  rowNumber: number;
  transactionDate: string;
  amount: string;
  transactionType: string;
  description: string;
  notes: string;
  category: string;
  status: TransactionImportPreviewStatus;
  message: string;
};

export type TransactionImportPreview = {
  headers: Array<string>;
  rows: Array<TransactionImportPreviewRow>;
  transactions: Array<TransactionImportPayload>;
  categories: Array<CategoryImportPayload>;
  summary: {
    totalRows: number;
    importableRows: number;
    duplicateRows: number;
    invalidRows: number;
    emptyRows: number;
    categoriesToCreate: number;
  };
};

export type TransactionImportPreviewOptions = {
  headerRowIndex: number;
  mapping: TransactionImportColumnMapping;
  amountMode: TransactionImportAmountMode;
  dateFormat: TransactionImportDateFormat;
  categoryLinkMode: TransactionImportCategoryLinkMode;
  categorySeparator: string;
  missingCategoryMode: TransactionImportMissingCategoryMode;
  expenseTypeValues: string;
  incomeTypeValues: string;
  existingCategories: Array<TransactionCategory>;
  existingTransactions: Array<Transaction>;
  createId?: () => string;
};

type ParsedCategoryPath = {
  parentName: string;
  name: string;
  isChild: boolean;
  display: string;
};

const emptyMapping: TransactionImportColumnMapping = {
  amount: null,
  transactionDate: null,
  transactionType: null,
  description: null,
  notes: null,
  categoryName: null,
  categoryParent: null,
};

const ISO_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const DATE_FORMAT_PATTERNS: Record<
  Exclude<TransactionImportDateFormat, "ISO">,
  {
    pattern: RegExp;
    order: ["year", "month", "day"] | ["day", "month", "year"] | ["month", "day", "year"];
  }
> = {
  "YYYY-MM-DD": { pattern: /^(\d{4})-(\d{2})-(\d{2})$/, order: ["year", "month", "day"] },
  "DD/MM/YYYY": { pattern: /^(\d{2})\/(\d{2})\/(\d{4})$/, order: ["day", "month", "year"] },
  "MM/DD/YYYY": { pattern: /^(\d{2})\/(\d{2})\/(\d{4})$/, order: ["month", "day", "year"] },
  "DD-MM-YYYY": { pattern: /^(\d{2})-(\d{2})-(\d{4})$/, order: ["day", "month", "year"] },
  "DD.MM.YYYY": { pattern: /^(\d{2})\.(\d{2})\.(\d{4})$/, order: ["day", "month", "year"] },
};

const DEFAULT_EXPENSE_TYPE_VALUES = "expense, debit, out";
const DEFAULT_INCOME_TYPE_VALUES = "income, credit, in";

const createFallbackId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `transaction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeName = (value: string) => value.trim();
const categoryKey = (value: string) => normalizeName(value).toLowerCase();
const childPathKey = (parentName: string, childName: string) =>
  `${categoryKey(parentName)}\u0000${categoryKey(childName)}`;

const isRowEmpty = (row: Array<string>) => row.every((value) => value.trim() === "");
const getCell = (row: Array<string>, column: number | null) =>
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

const parseTypeValueList = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

export const parseImportDate = (
  raw: string,
  format: TransactionImportDateFormat,
): { ok: true; value: string } | { ok: false; message: string } => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, message: "Date is required" };
  }

  if (format === "ISO") {
    const match = trimmed.match(ISO_DATETIME_PATTERN);

    if (!match) {
      return { ok: false, message: "Date must match ISO datetime (YYYY-MM-DDTHH:mm:ss)" };
    }

    const [, year, month, day, hour, minute, second = "00"] = match;
    const isoDate = `${year}-${month}-${day}`;
    const isoDateTime = `${isoDate}T${hour}:${minute}:${second}`;

    if (Number.isNaN(Date.parse(isoDateTime))) {
      return { ok: false, message: "Invalid date" };
    }

    return { ok: true, value: isoDateTime };
  }

  const { pattern, order } = DATE_FORMAT_PATTERNS[format];
  const match = trimmed.match(pattern);

  if (!match) {
    return { ok: false, message: `Date must match ${format}` };
  }

  const parts = { year: "", month: "", day: "" };

  if (order[0] === "year") {
    [, parts.year, parts.month, parts.day] = match;
  } else if (order[0] === "day") {
    [, parts.day, parts.month, parts.year] = match;
  } else {
    [, parts.month, parts.day, parts.year] = match;
  }

  const isoDate = `${parts.year}-${parts.month}-${parts.day}`;

  if (Number.isNaN(Date.parse(`${isoDate}T00:00:00`))) {
    return { ok: false, message: "Invalid date" };
  }

  return { ok: true, value: `${isoDate}T00:00:00` };
};

const resolveTypeFromColumn = (
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

const transactionDuplicateKey = (transactionDate: string, amount: number, description: string) =>
  `${transactionDate.slice(0, 10)}\u0000${amount}\u0000${description.trim().toLowerCase()}`;

const formatCategoryDisplay = (parsed: ParsedCategoryPath | null) => {
  if (!parsed?.name) {
    return "";
  }

  return parsed.isChild ? `${parsed.parentName} > ${parsed.name}` : parsed.name;
};

const parseCategoryPath = (
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
      const name = normalizeName(rawName);

      return { parentName: "", name, isChild: false, display: name };
    }

    const parentName = normalizeName(rawName.slice(0, separatorIndex));
    const name = normalizeName(rawName.slice(separatorIndex + separator.length));

    return {
      parentName,
      name,
      isChild: true,
      display: `${parentName} > ${name}`,
    };
  }

  const parentName = normalizeName(getCell(row, mapping.categoryParent));
  const name = normalizeName(rawName);

  return {
    parentName,
    name,
    isChild: parentName !== "",
    display: parentName ? `${parentName} > ${name}` : name,
  };
};

const buildCategoryLookups = (categories: Array<TransactionCategory>) => {
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

const countRowsByStatus = (
  rows: Array<TransactionImportPreviewRow>,
  status: TransactionImportPreviewStatus,
) => rows.filter((row) => row.status === status).length;

export const buildTransactionImportPreview = (
  content: string,
  options: TransactionImportPreviewOptions,
): TransactionImportPreview => {
  const rows = parseCategoryCsv(content);
  const headerRowIndex = Math.max(
    0,
    Math.min(options.headerRowIndex, Math.max(rows.length - 1, 0)),
  );
  const headers = rows[headerRowIndex] ?? [];
  const dataRows = rows.slice(headerRowIndex + 1);
  const mapping = options.mapping;
  const createId = options.createId ?? createFallbackId;
  const expenseValues = parseTypeValueList(options.expenseTypeValues);
  const incomeValues = parseTypeValueList(options.incomeTypeValues);
  const { rootIdByKey: existingRootIdByKey, childIdByPath: existingChildIdByPath } =
    buildCategoryLookups(options.existingCategories);
  const existingDuplicateKeys = new Set(
    options.existingTransactions.map((transaction) =>
      transactionDuplicateKey(
        transaction.transactionDate,
        transaction.amount,
        transaction.description ?? "",
      ),
    ),
  );
  const importedDuplicateKeys = new Set<string>();
  const previewRows: Array<TransactionImportPreviewRow> = [];
  const transactions: Array<TransactionImportPayload> = [];
  const categories: Array<CategoryImportPayload> = [];
  const importedRootIdByKey = new Map<string, string>();
  const importedChildIdByPath = new Map<string, string>();

  const ensureRootCategory = (name: string) => {
    const rootKey = categoryKey(name);
    const existingId = existingRootIdByKey.get(rootKey) ?? importedRootIdByKey.get(rootKey);

    if (existingId) {
      return existingId;
    }

    const id = createId();
    importedRootIdByKey.set(rootKey, id);
    categories.push({
      id,
      parentId: null,
      name,
      description: null,
      color: null,
    });

    return id;
  };

  const resolveCategoryId = (parsed: ParsedCategoryPath | null) => {
    if (!parsed?.name) {
      return { categoryId: null as string | null, message: "" };
    }

    if (!parsed.isChild) {
      const rootKey = categoryKey(parsed.name);
      const existingId = existingRootIdByKey.get(rootKey) ?? importedRootIdByKey.get(rootKey);

      if (existingId) {
        return { categoryId: existingId, message: "" };
      }

      if (options.missingCategoryMode === "uncategorized") {
        return { categoryId: null, message: "Category not found; imported uncategorized" };
      }

      return { categoryId: ensureRootCategory(parsed.name), message: "Category will be created" };
    }

    if (!parsed.parentName) {
      return { categoryId: null, message: "Parent category is required" };
    }

    const pathKey = childPathKey(parsed.parentName, parsed.name);
    const existingChildId =
      existingChildIdByPath.get(pathKey) ?? importedChildIdByPath.get(pathKey);

    if (existingChildId) {
      return { categoryId: existingChildId, message: "" };
    }

    if (options.missingCategoryMode === "uncategorized") {
      const parentRootId = existingRootIdByKey.get(categoryKey(parsed.parentName));

      if (parentRootId) {
        return {
          categoryId: parentRootId,
          message: `Child category "${parsed.name}" not found; imported with ${parsed.parentName}`,
        };
      }

      return { categoryId: null, message: "Category not found; imported uncategorized" };
    }

    const parentId = ensureRootCategory(parsed.parentName);
    const id = createId();
    importedChildIdByPath.set(pathKey, id);
    categories.push({
      id,
      parentId,
      name: parsed.name,
      description: null,
      color: null,
    });

    return { categoryId: id, message: "Category will be created" };
  };

  for (const [dataIndex, row] of dataRows.entries()) {
    const rowNumber = headerRowIndex + dataIndex + 2;

    if (isRowEmpty(row)) {
      previewRows.push({
        rowNumber,
        transactionDate: "",
        amount: "",
        transactionType: "",
        description: "",
        notes: "",
        category: "",
        status: "empty",
        message: "Empty row skipped",
      });
      continue;
    }

    if (mapping.amount === null || mapping.transactionDate === null) {
      previewRows.push({
        rowNumber,
        transactionDate: getCell(row, mapping.transactionDate),
        amount: getCell(row, mapping.amount),
        transactionType: "",
        description: getCell(row, mapping.description),
        notes: getCell(row, mapping.notes),
        category: formatCategoryDisplay(
          parseCategoryPath(row, mapping, options.categoryLinkMode, options.categorySeparator),
        ),
        status: "invalid",
        message: "Map amount and date columns",
      });
      continue;
    }

    const parsedAmount = parseImportAmount(getCell(row, mapping.amount));
    const parsedDate = parseImportDate(getCell(row, mapping.transactionDate), options.dateFormat);
    const description = normalizeName(getCell(row, mapping.description));
    const notes = normalizeName(getCell(row, mapping.notes));
    const categoryPath = parseCategoryPath(
      row,
      mapping,
      options.categoryLinkMode,
      options.categorySeparator,
    );

    const previewRow: TransactionImportPreviewRow = {
      rowNumber,
      transactionDate: getCell(row, mapping.transactionDate),
      amount: getCell(row, mapping.amount),
      transactionType: "",
      description,
      notes,
      category: formatCategoryDisplay(categoryPath),
      status: "import",
      message: "Ready to import",
    };

    if (!parsedAmount.ok) {
      previewRow.status = "invalid";
      previewRow.message = parsedAmount.message;
      previewRows.push(previewRow);
      continue;
    }

    if (!parsedDate.ok) {
      previewRow.status = "invalid";
      previewRow.message = parsedDate.message;
      previewRows.push(previewRow);
      continue;
    }

    let transactionType: TransactionType;

    if (options.amountMode === "signed") {
      transactionType = parsedAmount.signed < 0 ? "expense" : "income";
    } else {
      if (mapping.transactionType === null) {
        previewRow.status = "invalid";
        previewRow.message = "Map a transaction type column";
        previewRows.push(previewRow);
        continue;
      }

      const parsedType = resolveTypeFromColumn(
        getCell(row, mapping.transactionType),
        expenseValues,
        incomeValues,
      );

      if (!parsedType.ok) {
        previewRow.status = "invalid";
        previewRow.message = parsedType.message;
        previewRows.push(previewRow);
        continue;
      }

      transactionType = parsedType.value;
    }

    previewRow.transactionType = transactionType;

    const duplicateKey = transactionDuplicateKey(parsedDate.value, parsedAmount.cents, description);

    if (existingDuplicateKeys.has(duplicateKey) || importedDuplicateKeys.has(duplicateKey)) {
      previewRow.status = "duplicate";
      previewRow.message = "Duplicate transaction skipped";
      previewRows.push(previewRow);
      continue;
    }

    const { categoryId, message: categoryMessage } = resolveCategoryId(categoryPath);

    if (categoryMessage) {
      previewRow.message = categoryMessage;
    }

    importedDuplicateKeys.add(duplicateKey);
    previewRows.push(previewRow);
    transactions.push({
      id: createId(),
      description: description || null,
      amount: parsedAmount.cents,
      transactionDate: parsedDate.value,
      transactionType,
      transactionCategoryId: categoryId,
      notes: notes || null,
    });
  }

  return {
    headers,
    rows: previewRows,
    transactions,
    categories,
    summary: {
      totalRows: previewRows.length,
      importableRows: countRowsByStatus(previewRows, "import"),
      duplicateRows: countRowsByStatus(previewRows, "duplicate"),
      invalidRows: countRowsByStatus(previewRows, "invalid"),
      emptyRows: countRowsByStatus(previewRows, "empty"),
      categoriesToCreate: categories.length,
    },
  };
};
