import { z } from "zod";

export const RECURRING_PROCESSING_EVENT_VERSION = 1 as const;
export const RECURRING_PROCESSING_EVENT_NAME = "recurring-processing";

const startedSchema = z.strictObject({
  version: z.literal(RECURRING_PROCESSING_EVENT_VERSION),
  type: z.literal("started"),
  runId: z.string().min(1),
});

const progressSchema = z.strictObject({
  version: z.literal(RECURRING_PROCESSING_EVENT_VERSION),
  type: z.literal("progress"),
  runId: z.string().min(1),
  committed: z.number().int().nonnegative(),
  alreadyFulfilled: z.number().int().nonnegative(),
  moreDueRemaining: z.boolean(),
});

const finishedSchema = z.strictObject({
  version: z.literal(RECURRING_PROCESSING_EVENT_VERSION),
  type: z.literal("finished"),
  runId: z.string().min(1),
  committed: z.number().int().nonnegative(),
  alreadyFulfilled: z.number().int().nonnegative(),
  moreDueRemaining: z.boolean(),
  state: z.enum([
    "caughtUp",
    "budgetExhausted",
    "parked",
    "transientlyDelayed",
    "cancelled",
    "shuttingDown",
  ]),
});

const stateChangedSchema = z.strictObject({
  version: z.literal(RECURRING_PROCESSING_EVENT_VERSION),
  type: z.literal("stateChanged"),
});

export const recurringProcessingEventSchema = z.discriminatedUnion("type", [
  startedSchema,
  progressSchema,
  finishedSchema,
  stateChangedSchema,
]);

export type RecurringProcessingEvent = z.infer<typeof recurringProcessingEventSchema>;
