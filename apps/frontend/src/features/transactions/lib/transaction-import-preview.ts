import { parseCsv } from "@/lib/csv";
import type { CategoryImportPayload } from "@/features/categories/lib/category-import";
import { parseImportAmount } from "./parse-import-amount";
import { parseImportDate } from "./transaction-import-date";
import {
  buildCategoryLookups,
  categoryKey,
  childPathKey,
  createFallbackId,
  formatCategoryDisplay,
  getCell,
  isRowEmpty,
  normalizeName,
  parseCategoryPath,
  parseTypeValueList,
  resolveTypeFromColumn,
  transactionDuplicateKey,
  type ParsedCategoryPath,
} from "./transaction-import-row-parsing";
import type {
  ImportDuplicateCandidate,
  TransactionImportPayload,
  TransactionImportPreview,
  TransactionImportPreviewOptions,
  TransactionImportPreviewRow,
  TransactionImportPreviewStatus,
} from "./transaction-import-types";
import type { TransactionType } from "../types/model";

const countRowsByStatus = (
  rows: Array<TransactionImportPreviewRow>,
  status: TransactionImportPreviewStatus,
) => rows.filter((row) => row.status === status).length;

export const buildTransactionImportPreview = (
  content: string,
  options: TransactionImportPreviewOptions,
): TransactionImportPreview => {
  const rows = parseCsv(content);
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
  const existingDuplicateKeys = new Set(options.existingDuplicateKeys);
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
    categories.push({ id, parentId: null, name, description: null, color: null });
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
    categories.push({ id, parentId, name: parsed.name, description: null, color: null });
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
      previewRows.push({ ...previewRow, status: "invalid", message: parsedAmount.message });
      continue;
    }
    if (!parsedDate.ok) {
      previewRows.push({ ...previewRow, status: "invalid", message: parsedDate.message });
      continue;
    }

    let transactionType: TransactionType;
    if (options.amountMode === "signed") {
      transactionType = parsedAmount.signed < 0 ? "expense" : "income";
    } else {
      if (mapping.transactionType === null) {
        previewRows.push({
          ...previewRow,
          status: "invalid",
          message: "Map a transaction type column",
        });
        continue;
      }
      const parsedType = resolveTypeFromColumn(
        getCell(row, mapping.transactionType),
        expenseValues,
        incomeValues,
      );
      if (!parsedType.ok) {
        previewRows.push({ ...previewRow, status: "invalid", message: parsedType.message });
        continue;
      }
      transactionType = parsedType.value;
    }

    previewRow.transactionType = transactionType;
    const duplicateKey = transactionDuplicateKey(parsedDate.value, parsedAmount.cents, description);
    if (existingDuplicateKeys.has(duplicateKey) || importedDuplicateKeys.has(duplicateKey)) {
      previewRows.push({
        ...previewRow,
        status: "duplicate",
        message: "Duplicate transaction skipped",
      });
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

export const collectImportDuplicateCandidates = (
  content: string,
  options: Omit<TransactionImportPreviewOptions, "existingDuplicateKeys">,
): Array<ImportDuplicateCandidate> => {
  const preview = buildTransactionImportPreview(content, { ...options, existingDuplicateKeys: [] });
  return preview.transactions.map((transaction) => ({
    transactionDate: transaction.transactionDate,
    amount: transaction.amount,
    description: transaction.description ?? null,
  }));
};
