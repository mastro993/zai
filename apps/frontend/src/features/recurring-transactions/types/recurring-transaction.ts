import { z } from "zod";

import {
  MAX_TRANSACTION_AMOUNT_MINOR,
  prepareAmountForValidation,
} from "@/features/transactions/lib/transaction";

import {
  RECURRING_LIFECYCLES,
  SCHEDULE_INTERVAL_UNITS,
  SECTION_STATES,
  TRANSACTION_TYPES,
} from "./recurring-constants";
import { recurringFailuresSectionSchema } from "./recurring-failure";
import { budgetProjectionResultSchema } from "./budget-projection";

export {
  RECURRING_LIFECYCLES,
  SCHEDULE_INTERVAL_UNITS,
  SECTION_STATES,
  TRANSACTION_TYPES,
} from "./recurring-constants";
export {
  budgetPeriodForecastSchema,
  budgetProjectionResultSchema,
  projectedOccurrenceAttributionSchema,
  projectionSourceErrorSchema,
  type BudgetProjectionResult,
} from "./budget-projection";
export {
  generationFailureDiagnosticsSchema,
  recurringFailurePageSchema,
  recurringFailuresSectionSchema,
  recurringGenerationFailureSchema,
  recurringRecoveryActionSchema,
  recurringRepairPreviewSchema,
  type GenerationFailureDiagnostics,
  type RecurringFailurePage,
  type RecurringGenerationFailure,
  type RecurringRepairField,
  type RecurringRepairPreview,
} from "./recurring-failure";

const privilegedForbiddenShape = {
  zone: z.never().optional(),
  offset: z.never().optional(),
  cutoff: z.never().optional(),
  workBudget: z.never().optional(),
  executor: z.never().optional(),
  observation: z.never().optional(),
  observedLocal: z.never().optional(),
} as const;

const withPrivilegedRejection = <T extends z.ZodRawShape>(shape: T) =>
  z.object({
    ...shape,
    ...privilegedForbiddenShape,
  });

const amountInputSchema = z
  .string()
  .trim()
  .transform(prepareAmountForValidation)
  .pipe(
    z
      .string()
      .min(1, "Amount is required")
      .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Enter a valid amount")
      .refine((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0;
      }, "Amount must be zero or greater")
      .transform((value) => Math.round(Number(value) * 100)),
  )
  .pipe(z.number().int().max(MAX_TRANSACTION_AMOUNT_MINOR, "Amount exceeds supported maximum"));

export const scheduleRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("interval"),
    every: z.number().int().min(1, "Interval must be at least 1"),
    unit: z.enum(SCHEDULE_INTERVAL_UNITS),
  }),
  z.object({
    type: z.literal("monthlyDay"),
    day: z.number().int().min(1).max(31),
  }),
]);

export const recurringFormSchema = withPrivilegedRejection({
  scheduleKind: z.enum(["interval", "monthlyDay"]),
  intervalEvery: z.string().trim().default("1"),
  intervalUnit: z.enum(SCHEDULE_INTERVAL_UNITS).default("month"),
  monthlyDay: z.string().trim().default("1"),
  firstScheduledLocal: z.string().min(1, "First occurrence is required"),
  totalMode: z.enum(["indefinite", "finite"]).default("indefinite"),
  totalOccurrences: z.string().trim().optional(),
  description: z.string().trim().min(1, "Description is required"),
  amount: amountInputSchema,
  transactionType: z.enum(TRANSACTION_TYPES).default("expense"),
  transactionCategoryId: z.string().optional(),
  notes: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (value.scheduleKind === "interval") {
    const every = Number(value.intervalEvery);
    if (!Number.isInteger(every) || every < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Interval must be a positive whole number",
        path: ["intervalEvery"],
      });
    }
  } else {
    const day = Number(value.monthlyDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      ctx.addIssue({
        code: "custom",
        message: "Day must be between 1 and 31",
        path: ["monthlyDay"],
      });
    }
  }
  if (value.totalMode === "finite") {
    const total = Number(value.totalOccurrences);
    if (!Number.isInteger(total) || total < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Total must be a positive whole number",
        path: ["totalOccurrences"],
      });
    }
  }
});

export const recurringTransactionSchema = z.object({
  id: z.string().min(1),
  lifecycle: z.enum(RECURRING_LIFECYCLES),
  totalOccurrences: z.number().int().nullable(),
  fulfilledCount: z.number().int().nonnegative(),
  revision: z.number().int().positive(),
  lifecycleChangedAt: z.string(),
  pausedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
});

export const recurringScheduleRevisionSchema = z.object({
  id: z.string().min(1),
  recurringTransactionId: z.string().min(1),
  sequence: z.number().int().positive(),
  effectiveFromLocal: z.string(),
  effectiveUntilLocal: z.string().nullable().optional(),
  firstScheduledLocal: z.string(),
  rule: scheduleRuleSchema,
});

export const recurringTemplateRevisionSchema = z.object({
  id: z.string().min(1),
  recurringTransactionId: z.string().min(1),
  sequence: z.number().int().positive(),
  effectiveFromLocal: z.string(),
  effectiveUntilLocal: z.string().nullable().optional(),
  description: z.string().trim().min(1),
  amount: z.number().int().nonnegative(),
  transactionType: z.enum(TRANSACTION_TYPES),
  transactionCategoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const recurringOccurrenceHeadSchema = z.object({
  recurringTransactionId: z.string().min(1),
  scheduleRevisionId: z.string().min(1),
  nextOrdinal: z.number().int().positive(),
  nextScheduledLocal: z.string(),
});

export const recurringFeedItemSchema = z.object({
  recurringTransaction: recurringTransactionSchema,
  description: z.string().trim().min(1),
  nextScheduledLocal: z.string().nullable().optional(),
  needsAttention: z.boolean(),
});

export const recurringFeedFiltersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  lifecycle: z.enum(RECURRING_LIFECYCLES).optional(),
  needsAttention: z.boolean().optional(),
});

export const recurringFeedResultSchema = z.object({
  items: z.array(recurringFeedItemSchema),
  nextCursor: z.string().nullable().optional(),
  filterFingerprint: z.string().min(1),
});

export const recurringOccurrenceSchema = z.object({
  recurringTransactionId: z.string().min(1),
  scheduleRevisionId: z.string().min(1),
  ordinal: z.number().int().positive(),
  scheduledLocal: z.string(),
  templateRevisionId: z.string().min(1),
  fulfilledAt: z.string(),
  fulfillmentPosition: z.number().int().positive(),
  transactionId: z.string().min(1),
  fulfillmentKind: z.enum(["generated", "adopted"]),
  recurringAlertId: z.string().nullable().optional(),
});

export const recurringOccurrencePageSchema = z.object({
  items: z.array(recurringOccurrenceSchema),
  nextCursor: z.string().nullable().optional(),
});

export const recurringOccurrenceSummarySchema = z.object({
  fulfilledCount: z.number().int().nonnegative(),
  totalOccurrences: z.number().int().nullable(),
  nextScheduledLocal: z.string().nullable().optional(),
  needsAttention: z.boolean(),
});

export const recurringLinksSectionSchema = z.object({
  state: z.enum(SECTION_STATES),
  occurrences: recurringOccurrencePageSchema,
});

export const recurringBudgetImpactSectionSchema = z.object({
  state: z.enum(SECTION_STATES),
  message: z.string().optional(),
  projection: budgetProjectionResultSchema.optional(),
});

export const recurringTransactionDocumentSchema = withPrivilegedRejection({
  recurringTransaction: recurringTransactionSchema,
  schedule: recurringScheduleRevisionSchema,
  template: recurringTemplateRevisionSchema,
  head: recurringOccurrenceHeadSchema.nullable().optional(),
  occurrenceSummary: recurringOccurrenceSummarySchema,
  links: recurringLinksSectionSchema,
  failures: recurringFailuresSectionSchema,
  budgetImpact: recurringBudgetImpactSectionSchema,
});

export const recurringRecoveryOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("succeeded"),
    document: recurringTransactionDocumentSchema,
  }),
  z.object({
    outcome: z.literal("alreadyApplied"),
    document: recurringTransactionDocumentSchema,
  }),
  z.object({
    outcome: z.literal("unchanged"),
    document: recurringTransactionDocumentSchema,
    reason: z.string().min(1),
  }),
]);

export const recurringCreateOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("succeeded"),
    document: recurringTransactionDocumentSchema,
  }),
]);

export const recurringMutationOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("succeeded"),
    document: recurringTransactionDocumentSchema,
  }),
  z.object({
    outcome: z.literal("alreadyApplied"),
    document: recurringTransactionDocumentSchema,
  }),
  z.object({
    outcome: z.literal("unchanged"),
    document: recurringTransactionDocumentSchema,
    reason: z.string().min(1),
  }),
]);

export const recurringLifecycleOutcomeSchema = recurringMutationOutcomeSchema;
export const recurringAdoptOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("succeeded"),
    document: recurringTransactionDocumentSchema,
  }),
]);

export const adoptionPreviewSchema = z.object({
  transactionId: z.string().min(1),
  firstScheduledLocal: z.string(),
  laterDueCount: z.number().int().nonnegative(),
});

export const transactionRecurringProvenanceSchema = z.object({
  occurrence: recurringOccurrenceSchema,
  source: z
    .object({
      id: z.string().min(1),
      description: z.string().trim().min(1),
      lifecycle: z.enum(RECURRING_LIFECYCLES),
    })
    .nullable()
    .optional(),
});

export const newRecurringTransactionSchema = withPrivilegedRejection({
  schedule: scheduleRuleSchema,
  firstScheduledLocal: z.string().min(1),
  totalOccurrences: z.number().int().positive().nullable().optional(),
  template: z.object({
    description: z.string().trim().min(1),
    amount: z.number().int().nonnegative(),
    transactionType: z.enum(TRANSACTION_TYPES),
    transactionCategoryId: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
});

export const adoptRecurringFormSchema = withPrivilegedRejection({
  scheduleKind: z.enum(["interval", "monthlyDay"]),
  intervalEvery: z.string().trim().default("1"),
  intervalUnit: z.enum(SCHEDULE_INTERVAL_UNITS).default("month"),
  monthlyDay: z.string().trim().default("1"),
  totalMode: z.enum(["indefinite", "finite"]).default("indefinite"),
  totalOccurrences: z.string().trim().optional(),
  description: z.string().trim().min(1, "Description is required"),
  amount: amountInputSchema,
  transactionType: z.enum(TRANSACTION_TYPES).default("expense"),
  transactionCategoryId: z.string().optional(),
  notes: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (value.scheduleKind === "interval") {
    const every = Number(value.intervalEvery);
    if (!Number.isInteger(every) || every < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Interval must be a positive whole number",
        path: ["intervalEvery"],
      });
    }
  } else {
    const day = Number(value.monthlyDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      ctx.addIssue({
        code: "custom",
        message: "Day must be between 1 and 31",
        path: ["monthlyDay"],
      });
    }
  }
  if (value.totalMode === "finite") {
    const total = Number(value.totalOccurrences);
    if (!Number.isInteger(total) || total < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Total must be a positive whole number",
        path: ["totalOccurrences"],
      });
    }
  }
});

export type RecurringFormInput = z.input<typeof recurringFormSchema>;
export type RecurringFormValues = z.infer<typeof recurringFormSchema>;
export type AdoptRecurringFormInput = z.input<typeof adoptRecurringFormSchema>;
export type AdoptRecurringFormValues = z.infer<typeof adoptRecurringFormSchema>;
export type RecurringTransaction = z.infer<typeof recurringTransactionSchema>;
export type RecurringFeedItem = z.infer<typeof recurringFeedItemSchema>;
export type RecurringFeedFilters = z.infer<typeof recurringFeedFiltersSchema>;
export type RecurringFeedResult = z.infer<typeof recurringFeedResultSchema>;
export type RecurringTransactionDocument = z.infer<typeof recurringTransactionDocumentSchema>;
export type RecurringCreateOutcome = z.infer<typeof recurringCreateOutcomeSchema>;
export type RecurringMutationOutcome = z.infer<typeof recurringMutationOutcomeSchema>;
export type RecurringLifecycleOutcome = z.infer<typeof recurringLifecycleOutcomeSchema>;
export type RecurringAdoptOutcome = z.infer<typeof recurringAdoptOutcomeSchema>;
export type AdoptionPreview = z.infer<typeof adoptionPreviewSchema>;
export type RecurringOccurrence = z.infer<typeof recurringOccurrenceSchema>;
export type RecurringOccurrencePage = z.infer<typeof recurringOccurrencePageSchema>;
export type RecurringRecoveryOutcome = z.infer<typeof recurringRecoveryOutcomeSchema>;
export type TransactionRecurringProvenance = z.infer<typeof transactionRecurringProvenanceSchema>;
export type ScheduleRule = z.infer<typeof scheduleRuleSchema>;
export type RecurringLifecycle = (typeof RECURRING_LIFECYCLES)[number];
