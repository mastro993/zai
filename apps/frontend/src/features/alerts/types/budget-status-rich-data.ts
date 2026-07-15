import { z } from "zod";

import type { BudgetStatus } from "@/features/cash-flow/types/budget";

export const BUDGET_STATUS_RICH_KIND = "budget.status";
export const BUDGET_STATUS_RICH_VERSION = 1;

const budgetStatusSchema = z.enum(["onTrack", "warning", "overspent"]);

export const budgetStatusRichDataV1Schema = z.object({
  status: budgetStatusSchema,
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  effectiveAllowance: z.number().int(),
  netBudgetSpending: z.number().int(),
  remainingAllowance: z.number().int(),
  currency: z.string().min(3).max(3),
});

export type BudgetStatusRichDataV1 = z.infer<typeof budgetStatusRichDataV1Schema>;

export const parseBudgetStatusRichDataV1 = (
  payload: Record<string, unknown>,
): BudgetStatusRichDataV1 | null => {
  const parsed = budgetStatusRichDataV1Schema.safeParse(payload);
  return parsed.success ? parsed.data : null;
};

export const toBudgetStatus = (status: BudgetStatusRichDataV1["status"]): BudgetStatus => status;
