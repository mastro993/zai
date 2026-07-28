import {
  DEFAULT_CATEGORY_COLOR,
  type CategoryRole,
  type TransactionCategory,
} from "../types/model";

export const getCategoryDisplayColor = (category: TransactionCategory) => {
  if (category.parentId) {
    return category.parent?.color ?? DEFAULT_CATEGORY_COLOR;
  }

  return category.color ?? DEFAULT_CATEGORY_COLOR;
};

export const getCategoryDisplayName = (
  category: TransactionCategory,
  categoryById?: Map<string, TransactionCategory>,
) => {
  const parentName =
    category.parent?.name ??
    (category.parentId ? categoryById?.get(category.parentId)?.name : undefined);

  return parentName ? `${parentName} / ${category.name}` : category.name;
};

export const getCategoryRoleLabel = (role: CategoryRole) =>
  role === "income" ? "Income" : "Spending";

export const isCategoryColor = (color: unknown): color is string | null =>
  color === null || (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color));
