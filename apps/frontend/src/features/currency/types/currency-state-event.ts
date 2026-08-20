import { z } from "zod";

import { currencyJobTypeSchema } from "./currency";

export const CURRENCY_STATE_EVENT_VERSION = 1 as const;
export const CURRENCY_STATE_EVENT_NAME = "currency-state";

const startedSchema = z.strictObject({
  version: z.literal(CURRENCY_STATE_EVENT_VERSION),
  type: z.literal("started"),
  jobId: z.string().min(1),
  jobType: currencyJobTypeSchema,
});

const progressSchema = z.strictObject({
  version: z.literal(CURRENCY_STATE_EVENT_VERSION),
  type: z.literal("progress"),
  jobId: z.string().min(1),
  jobType: currencyJobTypeSchema,
  stageCurrent: z.number().int().nonnegative(),
  stageTotal: z.number().int().nonnegative(),
});

const finishedSchema = z.strictObject({
  version: z.literal(CURRENCY_STATE_EVENT_VERSION),
  type: z.literal("finished"),
  jobId: z.string().min(1),
  jobType: currencyJobTypeSchema,
  stageCurrent: z.number().int().nonnegative(),
  stageTotal: z.number().int().nonnegative(),
  state: z.enum(["succeeded", "failed", "cancelled"]),
});

const refreshProgressSchema = z.strictObject({
  version: z.literal(CURRENCY_STATE_EVENT_VERSION),
  type: z.literal("refreshProgress"),
  current: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

const stateChangedSchema = z.strictObject({
  version: z.literal(CURRENCY_STATE_EVENT_VERSION),
  type: z.literal("stateChanged"),
});

export const currencyStateEventSchema = z.discriminatedUnion("type", [
  startedSchema,
  progressSchema,
  finishedSchema,
  refreshProgressSchema,
  stateChangedSchema,
]);

export type CurrencyStateEvent = z.infer<typeof currencyStateEventSchema>;
