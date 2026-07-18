import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  type CategoryColor,
  type CategoryRole,
  type TransactionCategory,
} from "../types/model";

export const getCategoryDisplayColor = (category: TransactionCategory) => {
  if (category.parent) {
    return category.parent.color ?? DEFAULT_CATEGORY_COLOR;
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

export const isCategoryColor = (color: string): color is CategoryColor => {
  return CATEGORY_COLORS.some((categoryColor) => categoryColor === color);
};
