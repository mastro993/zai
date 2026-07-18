import type { TransactionCategory } from "../types/model";

interface CategoryGroup {
  root: TransactionCategory | null;
  children: Array<TransactionCategory>;
  visibleChildren: Array<TransactionCategory>;
}

interface CategorySelectionItem {
  category: TransactionCategory;
  label: string;
}

const matchesQuery = (category: TransactionCategory, query: string) =>
  category.name.toLocaleLowerCase().includes(query);

function groupCategories(
  categories: Array<TransactionCategory>,
  query: string,
): Array<CategoryGroup> {
  const roots = categories.filter((category) => !category.parentId);
  const rootIds = new Set(roots.map((category) => category.id));
  const childrenByParent = new Map<string, Array<TransactionCategory>>();

  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  const groups = roots.flatMap((root) => {
    const children = childrenByParent.get(root.id) ?? [];
    const rootMatches = matchesQuery(root, query);
    const visibleChildren = rootMatches
      ? children
      : children.filter((category) => matchesQuery(category, query));

    return query.length === 0 || rootMatches || visibleChildren.length > 0
      ? [{ root, children, visibleChildren }]
      : [];
  });
  const orphanedChildren = categories.filter(
    (category) =>
      category.parentId &&
      !rootIds.has(category.parentId) &&
      (query.length === 0 || matchesQuery(category, query)),
  );

  return orphanedChildren.length > 0
    ? [...groups, { root: null, children: orphanedChildren, visibleChildren: orphanedChildren }]
    : groups;
}

function getRootState(
  root: TransactionCategory,
  children: Array<TransactionCategory>,
  selectedIdSet: ReadonlySet<string>,
) {
  const rootSelected = selectedIdSet.has(root.id);
  const selectedChildCount = children.filter(
    (category) => rootSelected || selectedIdSet.has(category.id),
  ).length;
  const allChildrenSelected = children.length > 0 && selectedChildCount === children.length;

  return {
    checked: rootSelected || allChildrenSelected,
    indeterminate: !rootSelected && selectedChildCount > 0 && !allChildrenSelected,
  };
}

function toggleRootSelection(
  selectedIds: Array<string>,
  root: TransactionCategory,
  children: Array<TransactionCategory>,
  checked: boolean,
) {
  const groupIds = new Set([root.id, ...children.map((category) => category.id)]);
  const nextIds = selectedIds.filter((selectedId) => !groupIds.has(selectedId));
  return checked ? [...nextIds, root.id] : nextIds;
}

function toggleChildSelection(
  selectedIds: Array<string>,
  root: TransactionCategory,
  children: Array<TransactionCategory>,
  categoryId: string,
  checked: boolean,
) {
  const nextIdSet = new Set(selectedIds);
  if (nextIdSet.delete(root.id)) {
    for (const category of children) nextIdSet.add(category.id);
  }

  if (checked) nextIdSet.add(categoryId);
  else nextIdSet.delete(categoryId);

  if (children.every((category) => nextIdSet.has(category.id))) {
    for (const category of children) nextIdSet.delete(category.id);
    nextIdSet.add(root.id);
  }

  return Array.from(nextIdSet);
}

const formatCategoryScopeLabel = (
  category: TransactionCategory,
  categoriesById: ReadonlyMap<string, TransactionCategory>,
) => {
  if (!category.parentId) return category.name;
  const parent = category.parent ?? categoriesById.get(category.parentId);
  return parent ? `${parent.name} / ${category.name}` : category.name;
};

function getCategorySelectionItems(
  categories: Array<TransactionCategory>,
  selectedIds: Array<string>,
): Array<CategorySelectionItem> {
  const selectedIdSet = new Set(selectedIds);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  return groupCategories(categories, "").flatMap(({ root, children }) => {
    const selected = (() => {
      if (!root) return children.filter((category) => selectedIdSet.has(category.id));
      if (getRootState(root, children, selectedIdSet).checked) return [root];
      return children.filter((category) => selectedIdSet.has(category.id));
    })();

    return selected.map((category) => ({
      category,
      label: formatCategoryScopeLabel(category, categoriesById),
    }));
  });
}

export {
  getCategorySelectionItems,
  getRootState,
  groupCategories,
  toggleChildSelection,
  toggleRootSelection,
};
export type { CategoryGroup, CategorySelectionItem };
