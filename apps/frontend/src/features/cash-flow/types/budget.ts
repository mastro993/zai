import { z } from "zod";

import { prepareAmountForValidation } from "../lib/transaction";

export const BUDGET_MEASUREMENT_MODES = ["spending", "netCashFlow"] as const;
export const BUDGET_ROLLOVER_MODES = ["off", "previousPeriodOnly", "cumulative"] as const;
export const BUDGET_CADENCES = ["day", "week", "month", "year"] as const;
export const BUDGET_STATUSES = ["onTrack", "warning", "overspent"] as const;
export const BUDGET_LIST_FILTERS = ["active", "paused", "all"] as const;

const allowanceInputSchema = z
  .string()
  .trim()
  .transform(prepareAmountForValidation)
  .pipe(
    z
      .string()
      .min(1, "Allowance is required")
      .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Enter a valid allowance")
      .transform((value) => Math.round(Number(value) * 100)),
  );

const warningPercentageSchema = z
  .union([
    z.literal("disabled").transform(() => null),
    z
      .string()
      .trim()
      .min(1, "Warning percentage is required")
      .refine((value) => /^\d+$/.test(value), "Enter a whole percentage")
      .transform(Number)
      .refine((value) => value >= 1 && value <= 100, "Enter a percentage from 1 to 100"),
  ])
  .optional()
  .transform((value) => (value === undefined ? 80 : value));

export const budgetFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  baseAllowance: allowanceInputSchema,
  cadence: z.enum(BUDGET_CADENCES).default("month"),
  categoryIds: z.array(z.string()).default([]),
  measurementMode: z.enum(BUDGET_MEASUREMENT_MODES).default("spending"),
  rolloverMode: z.enum(BUDGET_ROLLOVER_MODES).default("off"),
  warningPercentage: warningPercentageSchema,
});

const budgetPeriodSchema = z.object({
  start: z.string(),
  end: z.string(),
  baseAllowance: z.number().int(),
  effectiveAllowance: z.number().int(),
  netBudgetSpending: z.number().int(),
  remainingAllowance: z.number().int(),
  status: z.enum(BUDGET_STATUSES),
});

export const budgetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  revision: z.number().int().nonnegative(),
  paused: z.boolean(),
  categoryIds: z.array(z.string()),
  cadence: z.enum(BUDGET_CADENCES),
  measurementMode: z.enum(BUDGET_MEASUREMENT_MODES),
  baseAllowance: z.number().int(),
  rolloverMode: z.enum(BUDGET_ROLLOVER_MODES),
  warningPercentage: z.number().int().nullable(),
  currentPeriod: budgetPeriodSchema,
});

export const budgetHistorySchema = z.object({
  data: z.array(budgetPeriodSchema),
  page: z.number().int(),
  perPage: z.number().int(),
  totalPages: z.number().int(),
});

export type BudgetFormInput = z.input<typeof budgetFormSchema>;
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export type BudgetListFilter = (typeof BUDGET_LIST_FILTERS)[number];
export type BudgetHistory = z.infer<typeof budgetHistorySchema>;
