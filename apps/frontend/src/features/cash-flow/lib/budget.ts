import type { TransactionCategory } from "../types/model";
import type { BudgetCadence } from "../types/budget-types";

const CADENCE_LABELS: Record<BudgetCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export const getBudgetCadenceLabel = (cadence: BudgetCadence) => CADENCE_LABELS[cadence];

export const suggestBudgetName = (
  categories: Array<TransactionCategory>,
  categoryIds: Array<string>,
) => {
  if (categoryIds.length === 0) {
    return "";
  }

  const categoryById = new Map(categories.map((category) => [category.id, category] as const));
  const labels = categoryIds
    .map((categoryId) => {
      const category = categoryById.get(categoryId);
      if (!category) {
        return null;
      }

      if (category.parentId) {
        const parent = categoryById.get(category.parentId);
        return parent ? `${parent.name} / ${category.name}` : category.name;
      }

      return category.name;
    })
    .filter((label): label is string => Boolean(label));

  return labels.join(", ");
};

export const formatBudgetScope = (targets: Array<{ categoryName: string; isRoot: boolean }>) => {
  if (targets.length === 0) {
    return "No scope";
  }

  return targets
    .map((target) => (target.isRoot ? `${target.categoryName} (root)` : target.categoryName))
    .join(", ");
};
