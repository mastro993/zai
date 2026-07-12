import type { BudgetStatus } from "../types/budget";

export const budgetStatusLabel: Record<BudgetStatus, string> = {
  onTrack: "On track",
  warning: "Warning",
  overspent: "Overspent",
};

export const budgetStatusVariant = (status: BudgetStatus) => {
  if (status === "overspent") return "destructive" as const;
  if (status === "warning") return "secondary" as const;
  return "outline" as const;
};
