import { z } from "zod";

import { prepareAmountForValidation } from "../lib/transaction";

export const BUDGET_CADENCES = ["daily", "weekly", "monthly", "yearly"] as const;
export const BUDGET_LIST_STATUSES = ["active", "deactivated", "all"] as const;

const budgetCadenceSchema = z.enum(BUDGET_CADENCES);
const budgetAllowanceSchema = z
  .string()
  .trim()
  .transform(prepareAmountForValidation)
  .pipe(
    z
      .string()
      .min(1, "Allowance is required")
      .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Enter a valid amount")
      .refine((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0;
      }, "Allowance must be zero or greater")
      .transform((value) => Math.round(Number(value) * 100)),
  );

export const budgetFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  allowance: budgetAllowanceSchema,
  cadence: budgetCadenceSchema,
  categoryIds: z.array(z.string()).min(1, "Select at least one category"),
});

const budgetScopeTargetSchema = z.object({
  categoryId: z.string().min(1),
  categoryName: z.string().min(1),
  isRoot: z.boolean(),
});

const budgetScopeSchema = z.object({
  targets: z.array(budgetScopeTargetSchema),
  effectiveCategoryIds: z.array(z.string()),
});

const budgetPeriodSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  allowance: z.number().int(),
  carriedBalance: z.number().int(),
  activity: z.number().int(),
  available: z.number().int(),
});

export const budgetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cadence: budgetCadenceSchema,
  status: z.enum(["active", "deactivated"]),
  firstPeriodStart: z.string().min(1),
  scope: budgetScopeSchema,
  currentPeriod: budgetPeriodSchema.nullable().optional(),
});

export type BudgetCadence = z.infer<typeof budgetCadenceSchema>;
export type BudgetListStatus = (typeof BUDGET_LIST_STATUSES)[number];
export type BudgetFormInput = z.input<typeof budgetFormSchema>;
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type BudgetPeriod = z.infer<typeof budgetPeriodSchema>;
