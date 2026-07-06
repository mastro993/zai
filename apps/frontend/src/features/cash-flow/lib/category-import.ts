import { parseCategoryCsv } from "./category-csv";
import type { TransactionCategory } from "../types/model";

export { parseCategoryCsv } from "./category-csv";

export type CategoryImportLinkMode = "columns" | "single-column";
export type CategoryImportPreviewStatus = "import" | "duplicate" | "invalid" | "empty";

export type CategoryImportColumnMapping = {
  name: number | null;
  parentName: number | null;
  color: number | null;
  description: number | null;
};

export type CategoryImportPayload = {
  id?: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
};

export type CategoryImportPreviewRow = {
  rowNumber: number;
  parentName: string;
  name: string;
  color: string;
  description: string;
  status: CategoryImportPreviewStatus;
  message: string;
};

export type CategoryImportPreview = {
  headers: Array<string>;
  rows: Array<CategoryImportPreviewRow>;
  categories: Array<CategoryImportPayload>;
  summary: {
    totalRows: number;
    importableRows: number;
    duplicateRows: number;
    invalidRows: number;
    emptyRows: number;
    autoCreatedParents: number;
    categoriesToCreate: number;
  };
};

export type CategoryImportPreviewOptions = {
  headerRowIndex: number;
  mapping: CategoryImportColumnMapping;
  linkMode: CategoryImportLinkMode;
  separator: string;
  existingCategories: Array<TransactionCategory>;
  createId?: () => string;
};

type ParsedCandidate = {
  previewIndex: number;
  parentName: string;
  name: string;
  color: string;
  description: string;
  isChild: boolean;
};

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const emptyMapping: CategoryImportColumnMapping = {
  name: null,
  parentName: null,
  color: null,
  description: null,
};

const createFallbackId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `category-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

export const inferCategoryImportMapping = (
  headers: Array<string>,
): CategoryImportColumnMapping => ({
  name: findHeaderIndex(headers, ["name", "category", "category_name"]),
  parentName: findHeaderIndex(headers, ["parent_name", "parent", "root", "root_category"]),
  color: findHeaderIndex(headers, ["color", "colour"]),
  description: findHeaderIndex(headers, ["description", "notes"]),
});

const getExistingCategoryPaths = (categories: Array<TransactionCategory>) => {
  const categoryById = new Map(categories.map((category) => [category.id, category] as const));
  const rootByKey = new Map<string, TransactionCategory>();
  const childPaths = new Set<string>();

  for (const category of categories) {
    if (!category.parentId) {
      rootByKey.set(categoryKey(category.name), category);
      continue;
    }

    const parent = category.parent ?? categoryById.get(category.parentId);
    if (parent) {
      childPaths.add(childPathKey(parent.name, category.name));
    }
  }

  return { rootByKey, childPaths };
};

const parseSingleColumnCategory = (
  row: Array<string>,
  mapping: CategoryImportColumnMapping,
  separator: string,
) => {
  const rawName = getCell(row, mapping.name);
  const separatorIndex = separator ? rawName.indexOf(separator) : -1;

  if (separatorIndex === -1) {
    return {
      parentName: "",
      name: normalizeName(rawName),
      isChild: false,
    };
  }

  return {
    parentName: normalizeName(rawName.slice(0, separatorIndex)),
    name: normalizeName(rawName.slice(separatorIndex + separator.length)),
    isChild: true,
  };
};

const parseColumnCategory = (row: Array<string>, mapping: CategoryImportColumnMapping) => {
  const parentName = normalizeName(getCell(row, mapping.parentName));

  return {
    parentName,
    name: normalizeName(getCell(row, mapping.name)),
    isChild: parentName !== "",
  };
};

const buildInvalidPreviewRow = (
  rowNumber: number,
  row: Array<string>,
  mapping: CategoryImportColumnMapping,
  message: string,
): CategoryImportPreviewRow => ({
  rowNumber,
  parentName: normalizeName(getCell(row, mapping.parentName)),
  name: normalizeName(getCell(row, mapping.name)),
  color: normalizeName(getCell(row, mapping.color)),
  description: normalizeName(getCell(row, mapping.description)),
  status: "invalid",
  message,
});

const countRowsByStatus = (
  rows: Array<CategoryImportPreviewRow>,
  status: CategoryImportPreviewStatus,
) => rows.filter((row) => row.status === status).length;

export const buildCategoryImportPreview = (
  content: string,
  options: CategoryImportPreviewOptions,
): CategoryImportPreview => {
  const rows = parseCategoryCsv(content);
  const headerRowIndex = Math.max(
    0,
    Math.min(options.headerRowIndex, Math.max(rows.length - 1, 0)),
  );
  const headers = rows[headerRowIndex] ?? [];
  const dataRows = rows.slice(headerRowIndex + 1);
  const mapping = options.mapping;
  const createId = options.createId ?? createFallbackId;
  const { rootByKey: existingRootByKey, childPaths: existingChildPaths } = getExistingCategoryPaths(
    options.existingCategories,
  );
  const previewRows: Array<CategoryImportPreviewRow> = [];
  const candidates: Array<ParsedCandidate> = [];

  for (const [dataIndex, row] of dataRows.entries()) {
    const rowNumber = headerRowIndex + dataIndex + 2;

    if (isRowEmpty(row)) {
      previewRows.push({
        rowNumber,
        parentName: "",
        name: "",
        color: "",
        description: "",
        status: "empty",
        message: "Empty row skipped",
      });
      continue;
    }

    if (mapping.name === null) {
      previewRows.push(
        buildInvalidPreviewRow(rowNumber, row, mapping, "Map a category name column"),
      );
      continue;
    }

    const parsed =
      options.linkMode === "single-column"
        ? parseSingleColumnCategory(row, mapping, options.separator)
        : parseColumnCategory(row, mapping);
    const color = normalizeName(getCell(row, mapping.color));
    const description = normalizeName(getCell(row, mapping.description));

    if (!parsed.name) {
      previewRows.push(
        buildInvalidPreviewRow(rowNumber, row, mapping, "Category name is required"),
      );
      continue;
    }

    if (parsed.isChild && !parsed.parentName) {
      previewRows.push(buildInvalidPreviewRow(rowNumber, row, mapping, "Parent name is required"));
      continue;
    }

    if (!parsed.isChild && color && !HEX_COLOR_REGEX.test(color)) {
      previewRows.push(buildInvalidPreviewRow(rowNumber, row, mapping, "Color must be #RRGGBB"));
      continue;
    }

    const previewRow: CategoryImportPreviewRow = {
      rowNumber,
      parentName: parsed.parentName,
      name: parsed.name,
      color: parsed.isChild ? "" : color.toUpperCase(),
      description,
      status: "import",
      message: "Ready to import",
    };

    candidates.push({
      previewIndex: previewRows.length,
      parentName: parsed.parentName,
      name: parsed.name,
      color: previewRow.color,
      description,
      isChild: parsed.isChild,
    });
    previewRows.push(previewRow);
  }

  const categories: Array<CategoryImportPayload> = [];
  const importedRootIdByKey = new Map<string, string>();
  const importedChildPaths = new Set<string>();
  let autoCreatedParents = 0;

  const ensureRootPayload = (name: string) => {
    const rootKey = categoryKey(name);
    const existingRoot = existingRootByKey.get(rootKey);

    if (existingRoot) {
      return existingRoot.id;
    }

    const existingImportedRootId = importedRootIdByKey.get(rootKey);
    if (existingImportedRootId) {
      return existingImportedRootId;
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
    autoCreatedParents += 1;

    return id;
  };

  for (const candidate of candidates) {
    const previewRow = previewRows[candidate.previewIndex];

    if (!candidate.isChild) {
      const rootKey = categoryKey(candidate.name);

      if (existingRootByKey.has(rootKey) || importedRootIdByKey.has(rootKey)) {
        previewRow.status = "duplicate";
        previewRow.message = "Category path already exists";
        continue;
      }

      const id = createId();
      importedRootIdByKey.set(rootKey, id);
      categories.push({
        id,
        parentId: null,
        name: candidate.name,
        description: candidate.description || null,
        color: candidate.color || null,
      });
      continue;
    }

    const pathKey = childPathKey(candidate.parentName, candidate.name);

    if (existingChildPaths.has(pathKey) || importedChildPaths.has(pathKey)) {
      previewRow.status = "duplicate";
      previewRow.message = "Category path already exists";
      continue;
    }

    const parentKey = categoryKey(candidate.parentName);
    const hadImportedParent = importedRootIdByKey.has(parentKey);
    const hadExistingParent = existingRootByKey.has(parentKey);
    const parentId = ensureRootPayload(candidate.parentName);

    if (!hadImportedParent && !hadExistingParent) {
      previewRow.message = "Ready to import; parent category will be created";
    }

    importedChildPaths.add(pathKey);
    categories.push({
      id: createId(),
      parentId,
      name: candidate.name,
      description: candidate.description || null,
      color: null,
    });
  }

  return {
    headers,
    rows: previewRows,
    categories,
    summary: {
      totalRows: previewRows.length,
      importableRows: countRowsByStatus(previewRows, "import"),
      duplicateRows: countRowsByStatus(previewRows, "duplicate"),
      invalidRows: countRowsByStatus(previewRows, "invalid"),
      emptyRows: countRowsByStatus(previewRows, "empty"),
      autoCreatedParents,
      categoriesToCreate: categories.length,
    },
  };
};

export const getDefaultCategoryImportMapping = (headers: Array<string>) => ({
  ...emptyMapping,
  ...inferCategoryImportMapping(headers),
});
