import { DEFAULT_CATEGORY_HUE, type CategoryRole, type TransactionCategory } from "../types/model";

export const getCategoryDisplayHue = (category: TransactionCategory) => {
  if (category.parentId) {
    return category.parent?.hue ?? DEFAULT_CATEGORY_HUE;
  }

  return category.hue ?? DEFAULT_CATEGORY_HUE;
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

export const isCategoryHue = (hue: unknown): hue is number | null =>
  hue === null || (typeof hue === "number" && Number.isInteger(hue) && hue >= 0 && hue <= 360);
