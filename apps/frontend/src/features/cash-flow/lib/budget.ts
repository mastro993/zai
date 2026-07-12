import type { BudgetStatus } from "../types/budget";

export const budgetCadenceLabel = {
  day: "Daily",
  week: "Monday-based week",
  month: "Monthly",
  year: "Yearly",
} as const;

export const budgetMeasurementLabel = {
  spending: "Spending",
  netCashFlow: "Net cash flow",
} as const;

export const budgetMeasurementOptionLabel = {
  spending: "Track spending",
  netCashFlow: "Track net cash flow",
} as const;

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
