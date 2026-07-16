import { parseCategoryCsv } from "./category-csv";
import { parseImportAmount } from "./parse-import-amount";
import { parseImportDate } from "./parse-import-date";
import {
  buildCategoryLookups,
  formatCategoryDisplay,
  normalizeName,
  parseCategoryPath,
  resolveCategoryId,
  type CategoryResolveContext,
} from "./transaction-import-categories";
import {
  type ImportDuplicateCandidate,
  transactionDuplicateKey,
} from "./transaction-import-duplicate";
import { getCell, isRowEmpty } from "./transaction-import-mapping";
import { parseTypeValueList, resolveTypeFromColumn } from "./transaction-import-type-resolution";
import type {
  TransactionImportPayload,
  TransactionImportPreview,
  TransactionImportPreviewOptions,
  TransactionImportPreviewRow,
  TransactionImportPreviewStatus,
} from "./transaction-import-types";
import type { TransactionType } from "../types/model";

const createFallbackId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `transaction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  const existingDuplicateKeys = new Set(options.existingDuplicateKeys);
  const importedDuplicateKeys = new Set<string>();
  const previewRows: Array<TransactionImportPreviewRow> = [];
  const transactions: Array<TransactionImportPayload> = [];
  const categories: CategoryResolveContext["categories"] = [];
  const importedRootIdByKey = new Map<string, string>();
  const importedChildIdByPath = new Map<string, string>();

  const categoryCtx: CategoryResolveContext = {
    existingRootIdByKey,
    importedRootIdByKey,
    existingChildIdByPath,
    importedChildIdByPath,
    categories,
    createId,
    missingCategoryMode: options.missingCategoryMode,
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

    const { categoryId, message: categoryMessage } = resolveCategoryId(categoryPath, categoryCtx);

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
  const preview = buildTransactionImportPreview(content, {
    ...options,
    existingDuplicateKeys: [],
  });

  return preview.transactions.map((transaction) => ({
    transactionDate: transaction.transactionDate,
    amount: transaction.amount,
    description: transaction.description ?? null,
  }));
};
