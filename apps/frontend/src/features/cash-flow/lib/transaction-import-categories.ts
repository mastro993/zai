import type { CategoryImportPayload } from "./category-import";
import { getCell } from "./transaction-import-mapping";
import type {
  ParsedCategoryPath,
  TransactionImportCategoryLinkMode,
  TransactionImportColumnMapping,
  TransactionImportMissingCategoryMode,
} from "./transaction-import-types";
import type { TransactionCategory } from "../types/model";

export const normalizeName = (value: string) => value.trim();
export const categoryKey = (value: string) => normalizeName(value).toLowerCase();
export const childPathKey = (parentName: string, childName: string) =>
  `${categoryKey(parentName)}\u0000${categoryKey(childName)}`;

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

export interface CategoryResolveContext {
  existingRootIdByKey: Map<string, string>;
  importedRootIdByKey: Map<string, string>;
  existingChildIdByPath: Map<string, string>;
  importedChildIdByPath: Map<string, string>;
  categories: Array<CategoryImportPayload>;
  createId: () => string;
  missingCategoryMode: TransactionImportMissingCategoryMode;
}

export const ensureRootCategory = (name: string, ctx: CategoryResolveContext) => {
  const rootKey = categoryKey(name);
  const existingId = ctx.existingRootIdByKey.get(rootKey) ?? ctx.importedRootIdByKey.get(rootKey);

  if (existingId) {
    return existingId;
  }

  const id = ctx.createId();
  ctx.importedRootIdByKey.set(rootKey, id);
  ctx.categories.push({
    id,
    parentId: null,
    name,
    description: null,
    color: null,
  });

  return id;
};

export const resolveCategoryId = (
  parsed: ParsedCategoryPath | null,
  ctx: CategoryResolveContext,
) => {
  if (!parsed?.name) {
    return { categoryId: null as string | null, message: "" };
  }

  if (!parsed.isChild) {
    const rootKey = categoryKey(parsed.name);
    const existingId = ctx.existingRootIdByKey.get(rootKey) ?? ctx.importedRootIdByKey.get(rootKey);

    if (existingId) {
      return { categoryId: existingId, message: "" };
    }

    if (ctx.missingCategoryMode === "uncategorized") {
      return { categoryId: null, message: "Category not found; imported uncategorized" };
    }

    return {
      categoryId: ensureRootCategory(parsed.name, ctx),
      message: "Category will be created",
    };
  }

  if (!parsed.parentName) {
    return { categoryId: null, message: "Parent category is required" };
  }

  const pathKey = childPathKey(parsed.parentName, parsed.name);
  const existingChildId =
    ctx.existingChildIdByPath.get(pathKey) ?? ctx.importedChildIdByPath.get(pathKey);

  if (existingChildId) {
    return { categoryId: existingChildId, message: "" };
  }

  if (ctx.missingCategoryMode === "uncategorized") {
    const parentRootId = ctx.existingRootIdByKey.get(categoryKey(parsed.parentName));

    if (parentRootId) {
      return {
        categoryId: parentRootId,
        message: `Child category "${parsed.name}" not found; imported with ${parsed.parentName}`,
      };
    }

    return { categoryId: null, message: "Category not found; imported uncategorized" };
  }

  const parentId = ensureRootCategory(parsed.parentName, ctx);
  const id = ctx.createId();
  ctx.importedChildIdByPath.set(pathKey, id);
  ctx.categories.push({
    id,
    parentId,
    name: parsed.name,
    description: null,
    color: null,
  });

  return { categoryId: id, message: "Category will be created" };
};
