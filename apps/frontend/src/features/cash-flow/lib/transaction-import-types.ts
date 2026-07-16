import type { CategoryImportPayload } from "./category-import";
import type { TransactionCategory } from "../types/model";

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

export interface TransactionImportColumnMapping {
  amount: number | null;
  transactionDate: number | null;
  transactionType: number | null;
  description: number | null;
  notes: number | null;
  categoryName: number | null;
  categoryParent: number | null;
}

export interface TransactionImportPayload {
  id?: string;
  description?: string | null;
  amount: number;
  transactionDate: string;
  transactionType: string;
  transactionCategoryId?: string | null;
  notes?: string | null;
}

export interface TransactionImportPreviewRow {
  rowNumber: number;
  transactionDate: string;
  amount: string;
  transactionType: string;
  description: string;
  notes: string;
  category: string;
  status: TransactionImportPreviewStatus;
  message: string;
}

export interface TransactionImportPreview {
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
}

export interface TransactionImportPreviewOptions {
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
  existingDuplicateKeys: Array<string>;
  createId?: () => string;
}

export interface ParsedCategoryPath {
  parentName: string;
  name: string;
  isChild: boolean;
  display: string;
}
