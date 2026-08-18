import { z } from "zod";

import { wireValueSchema } from "@/lib/wire";

export const currencyErrorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: wireValueSchema.optional(),
});

export const currencyBootstrapSchema = z.object({
  setupComplete: z.boolean(),
  defaultCurrency: z.string().nullable(),
});

export const supportedCurrencySchema = z.object({
  code: z.string().length(3),
  name: z.string(),
});

export const currencySettingsRowSchema = z.object({
  code: z.string().length(3),
  name: z.string(),
  status: z.enum(["enabled", "adding", "disabled", "failed"]),
  coverageFrom: z.string().nullable(),
  coverageTo: z.string().nullable(),
  lastRefresh: z.string().nullable(),
  refreshStatus: z.enum(["fresh", "stale", "failed", "idle"]),
  missingPeriods: z.array(z.string()),
  usedByRecurring: z.boolean(),
  isDefault: z.boolean(),
});

export const currencyJobTypeSchema = z.enum([
  "setup",
  "addCurrency",
  "changeDefault",
  "importPreview",
]);

export const currencyJobStatusSchema = z.enum(["running", "succeeded", "failed", "cancelled"]);

export const currencyJobSchema = z.object({
  jobId: z.string().min(1),
  type: currencyJobTypeSchema,
  status: currencyJobStatusSchema,
  stageCurrent: z.number().int().nonnegative(),
  stageTotal: z.number().int().nonnegative(),
  currencyCode: z.string().optional(),
  error: currencyErrorEnvelopeSchema.optional(),
});

export const currencyStatusViewSchema = z.object({
  job: currencyJobSchema.nullable(),
});

export type CurrencyBootstrap = z.infer<typeof currencyBootstrapSchema>;
export type SupportedCurrency = z.infer<typeof supportedCurrencySchema>;
export type CurrencySettingsRow = z.infer<typeof currencySettingsRowSchema>;
export type CurrencyJob = z.infer<typeof currencyJobSchema>;
export type CurrencyStatusView = z.infer<typeof currencyStatusViewSchema>;
