import { z } from "zod";

const budgetCadenceSchema = z.enum(["day", "week", "month", "year"]);
const budgetMeasurementModeSchema = z.enum(["spending", "netCashFlow"]);
const budgetRolloverModeSchema = z.enum(["off", "previousPeriodOnly", "cumulative"]);
const budgetStatusSchema = z.enum(["onTrack", "warning", "overspent"]);

export const projectionSourceErrorKindSchema = z.enum([
  "dueCatchUp",
  "generationBlocked",
  "staleBudgetTimeline",
  "missingRevision",
]);

export const projectionSourceErrorSchema = z.object({
  kind: projectionSourceErrorKindSchema,
  recurringTransactionId: z.string().nullable().optional(),
  budgetId: z.string().nullable().optional(),
  message: z.string(),
});

export const projectedOccurrenceAttributionSchema = z.object({
  recurringTransactionId: z.string(),
  scheduleRevisionId: z.string(),
  ordinal: z.number().int(),
  scheduledLocal: z.string(),
  description: z.string(),
  contribution: z.number().int(),
});

export const budgetPeriodForecastSchema = z.object({
  budgetId: z.string(),
  budgetName: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  cadence: budgetCadenceSchema,
  measurementMode: budgetMeasurementModeSchema,
  rolloverMode: budgetRolloverModeSchema,
  baseAllowance: z.number().int(),
  actualNetBudgetSpending: z.number().int(),
  projectedDelta: z.number().int(),
  forecastNetBudgetSpending: z.number().int(),
  effectiveAllowance: z.number().int().nullable().optional(),
  remainingAllowance: z.number().int().nullable().optional(),
  status: budgetStatusSchema.nullable().optional(),
  partial: z.boolean(),
  coveredUntil: z.string(),
  attribution: z.array(projectedOccurrenceAttributionSchema),
});

export const budgetProjectionResultSchema = z.object({
  observedLocal: z.string(),
  throughLocal: z.string(),
  horizonMonths: z.number().int().min(1).max(12),
  complete: z.boolean(),
  periods: z.array(budgetPeriodForecastSchema),
  sourceErrors: z.array(projectionSourceErrorSchema),
});

export type ProjectionSourceErrorKind = z.infer<typeof projectionSourceErrorKindSchema>;
export type BudgetPeriodForecast = z.infer<typeof budgetPeriodForecastSchema>;
export type BudgetProjectionResult = z.infer<typeof budgetProjectionResultSchema>;
