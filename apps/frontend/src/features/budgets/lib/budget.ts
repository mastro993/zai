import { formatCurrencyFromMinor } from "@/lib/currency";

import type { BudgetListFilter, BudgetStatus } from "../types/budget";

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

export const budgetMeasurementDescription = {
  spending:
    "Counts spending in the selected categories each period. Income is ignored — best when you want a pure spending ceiling.",
  netCashFlow:
    "Subtracts matching income from spending in the selected categories. Use when the same scope has money in and out.",
} as const;

export const budgetRolloverLabel = {
  off: "Disabled",
  previousPeriodOnly: "Previous period only",
  cumulative: "Cumulative",
} as const;

export const budgetRolloverOptionLabel = {
  off: "No rollover",
  previousPeriodOnly: "Previous period only",
  cumulative: "Cumulative",
} as const;

export const budgetRolloverDescription = {
  off: "Each period starts from the base allowance. Leftover or overspend does not carry forward.",
  previousPeriodOnly:
    "Carry leftover or overspend from the previous period only. Earlier periods do not stack.",
  cumulative:
    "Unused allowance and overspend accumulate across periods until you change this rule.",
} as const;

export const budgetStatusLabel = {
  onTrack: "On track",
  warning: "Warning",
  overspent: "Overspent",
} satisfies Record<BudgetStatus, string>;

export const budgetListFilterLabel = {
  active: "Active",
  paused: "Paused",
  all: "All",
} satisfies Record<BudgetListFilter, string>;

export const budgetStatusVariant = (status: BudgetStatus) => {
  if (status === "overspent") return "destructive" as const;
  if (status === "warning") return "secondary" as const;
  return "outline" as const;
};

export const formatBudgetPeriod = (start: string, end: string) =>
  `${start.slice(0, 10)} to ${end.slice(0, 10)}`;

export const formatBudgetMinor = (amount: number | null, currency: string) =>
  amount === null ? "—" : formatCurrencyFromMinor(amount, currency);

export const budgetPeriodStatusPresentation = (period: {
  status: BudgetStatus | null;
  complete: boolean;
}) => {
  if (!period.complete || period.status === null) {
    return { label: "Incomplete", variant: "outline" as const };
  }
  return {
    label: budgetStatusLabel[period.status],
    variant: budgetStatusVariant(period.status),
  };
};
