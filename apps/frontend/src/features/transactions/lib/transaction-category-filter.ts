import {
  getCategoryDisplayColor,
  getCategoryDisplayName,
} from "@/features/categories/lib/category";
import type { TransactionCategory } from "@/features/categories/types/model";

export type CategoryFilterSelection = {
  categoryIds: Array<string>;
  includeUncategorized: boolean;
};

export const DEFAULT_CATEGORY_FILTER_SELECTION: CategoryFilterSelection = {
  categoryIds: [],
  includeUncategorized: false,
};

export const isActiveCategoryFilter = (selection: CategoryFilterSelection): boolean =>
  selection.categoryIds.length > 0 || selection.includeUncategorized;

export const buildChildrenByParent = (categories: Array<TransactionCategory>) => {
  const childrenByParent = new Map<string, Array<TransactionCategory>>();

  for (const category of categories) {
    if (!category.parentId) {
      continue;
    }

    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  return childrenByParent;
};

export const getRootCategories = (categories: Array<TransactionCategory>) =>
  categories.filter((category) => !category.parentId);

export const isRootSelected = (selection: CategoryFilterSelection, rootId: string) =>
  selection.categoryIds.includes(rootId);

export const isChildSelected = (selection: CategoryFilterSelection, child: TransactionCategory) => {
  if (selection.categoryIds.includes(child.id)) {
    return true;
  }

  return child.parentId ? selection.categoryIds.includes(child.parentId) : false;
};

export const isChildIncludedByRollup = (
  selection: CategoryFilterSelection,
  child: TransactionCategory,
) =>
  child.parentId != null &&
  selection.categoryIds.includes(child.parentId) &&
  selection.categoryIds.includes(child.id);

// Empty-array wire semantics can't hold IDs and mean "uncategorized" at once, so
// named categories and uncategorized are mutually exclusive in the selection.
export const toggleRootSelection = (
  selection: CategoryFilterSelection,
  rootId: string,
  children: Array<TransactionCategory>,
): CategoryFilterSelection => {
  const childIds = children.map((child) => child.id);

  if (isRootSelected(selection, rootId)) {
    const remove = new Set([rootId, ...childIds]);
    return {
      includeUncategorized: false,
      categoryIds: selection.categoryIds.filter((id) => !remove.has(id)),
    };
  }

  return {
    includeUncategorized: false,
    categoryIds: [...new Set([...selection.categoryIds, rootId, ...childIds])],
  };
};

export const toggleChildSelection = (
  selection: CategoryFilterSelection,
  child: TransactionCategory,
  childrenByParent: Map<string, Array<TransactionCategory>>,
): CategoryFilterSelection => {
  if (!isChildSelected(selection, child)) {
    return {
      includeUncategorized: false,
      categoryIds: [...selection.categoryIds, child.id],
    };
  }

  if (child.parentId && selection.categoryIds.includes(child.parentId)) {
    const siblings = childrenByParent.get(child.parentId) ?? [];
    const remainingChildIds = siblings
      .filter((sibling) => sibling.id !== child.id)
      .map((sibling) => sibling.id);

    const categoryIds = selection.categoryIds.filter(
      (id) => id !== child.parentId && id !== child.id,
    );

    return {
      includeUncategorized: false,
      categoryIds: [...new Set([...categoryIds, ...remainingChildIds])],
    };
  }

  return {
    includeUncategorized: false,
    categoryIds: selection.categoryIds.filter((id) => id !== child.id),
  };
};

export const toggleUncategorized = (selection: CategoryFilterSelection): CategoryFilterSelection =>
  selection.includeUncategorized
    ? DEFAULT_CATEGORY_FILTER_SELECTION
    : { categoryIds: [], includeUncategorized: true };

export const expandCategoryIdsForApi = (
  categoryIds: Array<string>,
  categories: Array<TransactionCategory>,
): Array<string> => {
  const categoryById = new Map(categories.map((category) => [category.id, category] as const));
  const childrenByParent = buildChildrenByParent(categories);
  const expanded = new Set<string>();

  for (const id of categoryIds) {
    expanded.add(id);

    const category = categoryById.get(id);
    if (category && !category.parentId) {
      for (const child of childrenByParent.get(id) ?? []) {
        expanded.add(child.id);
      }
    }
  }

  return [...expanded];
};

const getLogicalSelectionLabels = (
  selection: CategoryFilterSelection,
  categories: Array<TransactionCategory>,
): Array<string> => {
  const labels: Array<string> = [];

  if (selection.includeUncategorized) {
    labels.push("Uncategorized");
  }

  const categoryById = new Map(categories.map((category) => [category.id, category] as const));

  for (const root of getRootCategories(categories)) {
    if (selection.categoryIds.includes(root.id)) {
      labels.push(root.name);
    }
  }

  for (const category of categories) {
    if (!category.parentId) {
      continue;
    }

    if (
      selection.categoryIds.includes(category.id) &&
      !selection.categoryIds.includes(category.parentId)
    ) {
      labels.push(getCategoryDisplayName(category, categoryById));
    }
  }

  return labels;
};

export const formatCategoryFilterLabel = (
  selection: CategoryFilterSelection,
  categories: Array<TransactionCategory>,
): string => {
  const labels = getLogicalSelectionLabels(selection, categories);

  if (labels.length === 0) {
    return "All categories";
  }

  if (labels.length === 1) {
    return labels[0] ?? "All categories";
  }

  return `${labels[0]} +${labels.length - 1}`;
};

export const matchesCategorySearch = (
  category: TransactionCategory,
  categoryById: Map<string, TransactionCategory>,
  query: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return getCategoryDisplayName(category, categoryById).toLowerCase().includes(normalizedQuery);
};

export const getCategoryDotColor = (category: TransactionCategory) =>
  getCategoryDisplayColor(category);
