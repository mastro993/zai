import { parseCsv } from "@/lib/csv";
import { isoFractionDigits } from "@/lib/currency";
import type { TransactionCategory } from "@/features/categories/types/model";
import type { MappedImportRow, NativeRateFields, RateDirection } from "../types/import";
import type { RateOrigin, RateVariant } from "../types/model";
import { parseImportAmount } from "./parse-import-amount";
import { parseImportDate } from "./transaction-import-date";
import {
  buildCategoryLookups,
  formatCategoryDisplay,
  getCell,
  isRowEmpty,
  normalizeName,
  parseCategoryPath,
  parseTypeValueList,
  resolveTypeFromColumn,
} from "./transaction-import-row-parsing";
import { isZaiTransactionExport } from "./transaction-import-mapping";
import type {
  TransactionImportAmountMode,
  TransactionImportCategoryLinkMode,
  TransactionImportColumnMapping,
  TransactionImportDateFormat,
  TransactionImportMissingCategoryMode,
} from "./transaction-import-types";

export interface MapTransactionImportOptions {
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
  confirmedTransactionCurrency?: string;
  rateDirection: RateDirection;
}

const RATE_VARIANTS = new Set<RateVariant>(["identity", "automatic", "manual", "pending"]);
const RATE_ORIGINS = new Set<RateOrigin>(["supplied", "manual"]);

const headerIndexMap = (headers: Array<string>) => {
  const indexes = new Map<string, number>();
  headers.forEach((header, index) => {
    indexes.set(header.trim().toLowerCase(), index);
  });
  return indexes;
};

const optionalCell = (row: Array<string>, index: number | undefined) => {
  if (index === undefined) {
    return undefined;
  }
  const value = normalizeName(row[index] ?? "");
  return value || undefined;
};

const parseIntegerCell = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }
  if (!/^-?\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const parseNativeFields = (
  row: Array<string>,
  indexes: Map<string, number>,
): NativeRateFields | undefined => {
  const exportVersion = parseIntegerCell(optionalCell(row, indexes.get("zai_export_version")));
  const rateVariantRaw = optionalCell(row, indexes.get("rate_variant"));
  const originRaw = optionalCell(row, indexes.get("origin"));
  const rateDate = optionalCell(row, indexes.get("rate_date"));
  const sourceCurrency = optionalCell(row, indexes.get("source_currency"));
  const referenceCurrency = optionalCell(row, indexes.get("reference_currency"));
  const rateState = optionalCell(row, indexes.get("rate_state"));
  if (
    exportVersion === undefined ||
    rateVariantRaw === undefined ||
    originRaw === undefined ||
    rateDate === undefined ||
    sourceCurrency === undefined ||
    referenceCurrency === undefined ||
    rateState === undefined
  ) {
    return undefined;
  }
  if (
    !RATE_VARIANTS.has(rateVariantRaw as RateVariant) ||
    !RATE_ORIGINS.has(originRaw as RateOrigin)
  ) {
    return undefined;
  }

  return {
    exportVersion,
    rateVariant: rateVariantRaw as RateVariant,
    rateState,
    rateDate,
    sourceObservationDate: optionalCell(row, indexes.get("source_observation_date")),
    sourceCurrency,
    referenceCurrency,
    coefficient: parseIntegerCell(optionalCell(row, indexes.get("coefficient"))),
    scale: parseIntegerCell(optionalCell(row, indexes.get("scale"))),
    originalDecimal: optionalCell(row, indexes.get("original_decimal")),
    formulaVersion: parseIntegerCell(optionalCell(row, indexes.get("formula_version"))),
    origin: originRaw as RateOrigin,
  };
};

const resolveExistingCategoryNames = (
  options: MapTransactionImportOptions,
  row: Array<string>,
): { parentCategory?: string; category?: string } => {
  const parsed = parseCategoryPath(
    row,
    options.mapping,
    options.categoryLinkMode,
    options.categorySeparator,
  );
  if (!parsed?.name) {
    return {};
  }
  if (options.missingCategoryMode === "create") {
    return parsed.isChild
      ? { parentCategory: parsed.parentName, category: parsed.name }
      : { category: parsed.name };
  }

  const { rootIdByKey, childIdByPath } = buildCategoryLookups(options.existingCategories);
  if (!parsed.isChild) {
    return rootIdByKey.has(parsed.name.toLowerCase()) ? { category: parsed.name } : {};
  }
  const childExists = childIdByPath.has(
    `${parsed.parentName.toLowerCase()}\u0000${parsed.name.toLowerCase()}`,
  );
  if (childExists) {
    return { parentCategory: parsed.parentName, category: parsed.name };
  }
  if (rootIdByKey.has(parsed.parentName.toLowerCase())) {
    return { category: parsed.parentName };
  }
  return {};
};

export const mapTransactionImportRows = (
  content: string,
  options: MapTransactionImportOptions,
): { hasCurrencyColumn: boolean; isZaiExport: boolean; rows: Array<MappedImportRow> } => {
  const table = parseCsv(content);
  const headerRowIndex = Math.max(
    0,
    Math.min(options.headerRowIndex, Math.max(table.length - 1, 0)),
  );
  const headers = table[headerRowIndex] ?? [];
  const nativeExport = isZaiTransactionExport(headers);
  const indexes = headerIndexMap(headers);
  const hasCurrencyColumn = options.mapping.currency !== null || nativeExport;
  const expenseValues = parseTypeValueList(options.expenseTypeValues);
  const incomeValues = parseTypeValueList(options.incomeTypeValues);
  const confirmed = options.confirmedTransactionCurrency?.trim().toUpperCase();

  const rows = table.slice(headerRowIndex + 1).map((row, dataIndex) => {
    const rowNumber = headerRowIndex + dataIndex + 2;
    if (isRowEmpty(row)) {
      return { rowNumber, empty: true };
    }

    const mapped: MappedImportRow = { rowNumber };
    const parsedDate = parseImportDate(
      getCell(row, options.mapping.transactionDate),
      options.dateFormat,
    );
    if (parsedDate.ok) {
      mapped.date = parsedDate.value;
    }

    const currencyCell = getCell(row, options.mapping.currency).trim().toUpperCase();
    if (hasCurrencyColumn) {
      if (currencyCell) {
        mapped.currency = currencyCell;
      }
    } else if (confirmed) {
      mapped.currency = confirmed;
    }

    const amountMinorCell = getCell(row, options.mapping.amountMinor).trim();
    if (amountMinorCell) {
      mapped.amountMinor = parseIntegerCell(amountMinorCell);
    } else {
      const fractionDigits = isoFractionDigits(mapped.currency ?? confirmed ?? "EUR");
      const parsedAmount = parseImportAmount(getCell(row, options.mapping.amount), fractionDigits);
      if (parsedAmount.ok) {
        mapped.amountMinor = parsedAmount.cents;
      }
    }

    if (options.amountMode === "signed" && mapped.amountMinor !== undefined) {
      const parsedAmount = parseImportAmount(
        getCell(row, options.mapping.amount),
        isoFractionDigits(mapped.currency ?? confirmed ?? "EUR"),
      );
      mapped.transactionType = parsedAmount.ok && parsedAmount.signed < 0 ? "expense" : "income";
    } else {
      const parsedType = resolveTypeFromColumn(
        getCell(row, options.mapping.transactionType),
        expenseValues,
        incomeValues,
      );
      if (parsedType.ok) {
        mapped.transactionType = parsedType.value;
      }
    }

    const stripFormulaGuard = (value: string) => (value.startsWith("\t") ? value.slice(1) : value);

    const description = stripFormulaGuard(normalizeName(getCell(row, options.mapping.description)));
    const notes = stripFormulaGuard(normalizeName(getCell(row, options.mapping.notes)));
    if (description) {
      mapped.description = description;
    }
    if (notes) {
      mapped.notes = notes;
    }

    const categoryNames = resolveExistingCategoryNames(options, row);
    if (categoryNames.parentCategory) {
      mapped.parentCategory = categoryNames.parentCategory;
    }
    if (categoryNames.category) {
      mapped.category = categoryNames.category;
    }

    if (nativeExport) {
      mapped.native = parseNativeFields(row, indexes);
    } else {
      const rate = getCell(row, options.mapping.rate).trim();
      if (rate) {
        mapped.mappedRate = {
          rate,
          direction: options.rateDirection,
          rateDate: getCell(row, options.mapping.rateDate).trim() || undefined,
        };
      }
    }

    return mapped;
  });

  return { hasCurrencyColumn, isZaiExport: nativeExport, rows };
};

export const formatMappedCategoryDisplay = (
  row: Array<string>,
  mapping: TransactionImportColumnMapping,
  linkMode: TransactionImportCategoryLinkMode,
  separator: string,
) => formatCategoryDisplay(parseCategoryPath(row, mapping, linkMode, separator));
