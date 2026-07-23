import { z } from "zod";

export const recurringBulkActions = ["pause", "resume", "stop", "delete", "retryNow"] as const;

export const recurringBulkActionSchema = z.enum(recurringBulkActions);

export const recurringBulkItemSchema = z.object({
  recurringTransactionId: z.string().min(1),
  expectedRevision: z.number().int().min(1),
});

export const recurringBulkRequestSchema = z.object({
  action: recurringBulkActionSchema,
  items: z.array(recurringBulkItemSchema).min(1).max(500),
});

export const recurringBulkLifecycleCountsSchema = z.object({
  active: z.number().int().nonnegative(),
  paused: z.number().int().nonnegative(),
  stopped: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  needsAttention: z.number().int().nonnegative(),
});

export const recurringBulkUnchangedItemSchema = z.object({
  recurringTransactionId: z.string().min(1),
  reason: z.string().min(1),
  nextAction: z.string().optional(),
});

export const recurringBulkPreflightSchema = z.object({
  selected: z.number().int().nonnegative(),
  eligible: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  lifecycle: recurringBulkLifecycleCountsSchema,
  dueCatchUp: z.number().int().nonnegative(),
  waiting: z.number().int().nonnegative(),
  repairNeeded: z.number().int().nonnegative(),
  eligibleItems: z.array(recurringBulkItemSchema),
  unchangedItems: z.array(recurringBulkUnchangedItemSchema),
});

export const recurringBulkItemOutcomeKindSchema = z.enum(["succeeded", "unchanged", "failed"]);

export const recurringBulkItemResultSchema = z.object({
  recurringTransactionId: z.string().min(1),
  outcome: recurringBulkItemOutcomeKindSchema,
  reason: z.string().optional(),
  nextAction: z.string().optional(),
});

export const recurringBulkExecuteResultSchema = z.object({
  results: z.array(recurringBulkItemResultSchema),
  succeeded: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const recurringMatchingIdentitySchema = z.object({
  recurringTransactionId: z.string().min(1),
  expectedRevision: z.number().int().min(1),
});

export const recurringMatchingIdsSchema = z.object({
  fingerprint: z.string().min(1),
  items: z.array(recurringMatchingIdentitySchema),
});

export type RecurringBulkAction = z.infer<typeof recurringBulkActionSchema>;
export type RecurringBulkItem = z.infer<typeof recurringBulkItemSchema>;
export type RecurringBulkRequest = z.infer<typeof recurringBulkRequestSchema>;
export type RecurringBulkPreflight = z.infer<typeof recurringBulkPreflightSchema>;
export type RecurringBulkExecuteResult = z.infer<typeof recurringBulkExecuteResultSchema>;
export type RecurringBulkItemResult = z.infer<typeof recurringBulkItemResultSchema>;
export type RecurringMatchingIds = z.infer<typeof recurringMatchingIdsSchema>;
