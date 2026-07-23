import { z } from "zod";

import { SECTION_STATES } from "./recurring-constants";

export const RECURRING_REPAIR_FIELDS = ["amount", "transactionCategoryId"] as const;
export const recurringRepairFieldSchema = z.enum(RECURRING_REPAIR_FIELDS);

export const recurringGenerationFailureSchema = z.object({
  recurringTransactionId: z.string().min(1),
  scheduleRevisionId: z.string().min(1),
  ordinal: z.number().int().positive(),
  errorCode: z.string().min(1),
  causeCategory: z.string().min(1),
  repairFieldKey: recurringRepairFieldSchema.nullable().optional(),
  correlationId: z.string().min(1),
  failedScheduledLocal: z.string(),
  firstFailedAt: z.string(),
  lastFailedAt: z.string(),
  attemptCount: z.number().int().positive(),
  repairedAt: z.string().nullable().optional(),
  repairRevision: z.number().int().positive().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  resolutionKind: z.string().nullable().optional(),
  generationFailureAlertId: z.string().min(1),
});

export const recurringFailurePageSchema = z.object({
  items: z.array(recurringGenerationFailureSchema),
  nextCursor: z.string().nullable().optional(),
});

export const recurringRecoveryActionSchema = z.enum(["repair", "retry", "copyDiagnostics"]);

export const recurringFailuresSectionSchema = z.object({
  state: z.enum(SECTION_STATES),
  unresolved: recurringGenerationFailureSchema.nullable().optional(),
  waitingCount: z.number().int().nonnegative(),
  nextAction: recurringRecoveryActionSchema.nullable().optional(),
  history: recurringFailurePageSchema,
});

export const recurringRepairPreviewSchema = z.object({
  repairFieldKey: recurringRepairFieldSchema,
  affectedUnfulfilledSegmentCount: z.number().int().nonnegative(),
  includesFutureTemplate: z.boolean(),
  nextAction: recurringRecoveryActionSchema,
});

export const generationFailureDiagnosticsSchema = z
  .object({
    errorCode: z.string().min(1),
    appVersion: z.string().min(1),
    schemaVersion: z.string().min(1),
    firstFailedAt: z.string(),
    lastFailedAt: z.string(),
    typedState: z.string().min(1),
    correlationId: z.string().min(1),
  })
  .strict();

export type RecurringGenerationFailure = z.infer<typeof recurringGenerationFailureSchema>;
export type RecurringFailurePage = z.infer<typeof recurringFailurePageSchema>;
export type RecurringRepairPreview = z.infer<typeof recurringRepairPreviewSchema>;
export type GenerationFailureDiagnostics = z.infer<typeof generationFailureDiagnosticsSchema>;
export type RecurringRepairField = z.infer<typeof recurringRepairFieldSchema>;
