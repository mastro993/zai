import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  type CategoryColor,
  type TransactionCategory,
} from "../types/model";

export const getCategoryDisplayColor = (category: TransactionCategory) => {
  if (category.parent) {
    return category.parent.color ?? DEFAULT_CATEGORY_COLOR;
  }

  return category.color ?? DEFAULT_CATEGORY_COLOR;
};

export const isCategoryColor = (color: string): color is CategoryColor => {
  return CATEGORY_COLORS.some((categoryColor) => categoryColor === color);
};
