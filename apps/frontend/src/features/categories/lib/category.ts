import { asWireString } from "@/lib/wire";

import {
  DEFAULT_CATEGORY_COLOR,
  type CategoryRole,
  type TransactionCategory,
} from "../types/model";
import { DEFAULT_CATEGORY_ICON, type CategoryIcon } from "./category-icon";

export const getCategoryDisplayColor = (category: TransactionCategory) => {
  if (category.parentId) {
    return category.parent?.color ?? DEFAULT_CATEGORY_COLOR;
  }

  return category.color ?? DEFAULT_CATEGORY_COLOR;
};

export const getCategoryDisplayIcon = (category: TransactionCategory): CategoryIcon => {
  if (category.icon) {
    return category.icon;
  }

  if (category.parentId) {
    return category.parent?.icon ?? DEFAULT_CATEGORY_ICON;
  }

  return DEFAULT_CATEGORY_ICON;
};

export const getCategoryPathNames = (
  category: TransactionCategory,
  categoryById?: Map<string, TransactionCategory>,
): Array<string> => {
  const parentName =
    category.parent?.name ??
    (category.parentId ? categoryById?.get(category.parentId)?.name : undefined);

  return parentName ? [parentName, category.name] : [category.name];
};

export const getCategoryDisplayName = (
  category: TransactionCategory,
  categoryById?: Map<string, TransactionCategory>,
) => getCategoryPathNames(category, categoryById).join(" / ");

export const getCategoryRoleLabel = (role: CategoryRole) =>
  role === "income" ? "Income" : "Spending";

export const isCategoryColor = <TRaw>(color: TRaw): boolean => {
  if (color === null) {
    return true;
  }
  const text = asWireString(color);
  return text !== undefined && /^#[0-9a-f]{6}$/i.test(text);
};
