import { z } from "zod";

import { currencyJobSchema } from "@/features/currency/types/currency";

import { rateOriginSchema, rateVariantSchema, transactionSchema } from "./model";

export const rateDirectionSchema = z.enum(["transactionToDefault", "defaultToTransaction"]);
export const currencyPrepActionSchema = z.enum(["alreadyEnabled", "add", "reEnable", "backfill"]);
export const importPreviewRowStatusSchema = z.enum(["import", "duplicate", "invalid", "empty"]);

export const mappedExternalRateSchema = z.object({
  rate: z.string().min(1),
  direction: rateDirectionSchema,
  rateDate: z.string().optional(),
});

export const nativeRateFieldsSchema = z.object({
  exportVersion: z.number().int().positive(),
  rateVariant: rateVariantSchema,
  rateState: z.string().min(1),
  rateDate: z.string().min(1),
  sourceObservationDate: z.string().optional(),
  sourceCurrency: z.string().min(1),
  referenceCurrency: z.string().min(1),
  coefficient: z.number().int().optional(),
  scale: z.number().int().nonnegative().optional(),
  originalDecimal: z.string().optional(),
  formulaVersion: z.number().int().optional(),
  origin: rateOriginSchema,
});

export const mappedImportRowSchema = z.object({
  rowNumber: z.number().int(),
  empty: z.boolean().optional(),
  date: z.string().optional(),
  amountMinor: z.number().int().optional(),
  currency: z.string().optional(),
  transactionType: z.string().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  parentCategory: z.string().optional(),
  category: z.string().optional(),
  mappedRate: mappedExternalRateSchema.optional(),
  native: nativeRateFieldsSchema.optional(),
});

export const previewTransactionImportRequestSchema = z.object({
  fileDigest: z.string().min(1),
  hasCurrencyColumn: z.boolean(),
  confirmedTransactionCurrency: z.string().optional(),
  confirmProviderDisclosure: z.boolean().optional(),
  rows: z.array(mappedImportRowSchema),
});

export const importPreviewBindingSchema = z.object({
  fileDigest: z.string().min(1),
  defaultCurrencyRevision: z.number().int(),
  manifestVersion: z.string().min(1),
  coverageProof: z.string().min(1),
});

export const importPreviewRowResultSchema = z.object({
  rowNumber: z.number().int(),
  status: importPreviewRowStatusSchema,
  message: z.string(),
  transactionDate: z.string().optional(),
  amountMinor: z.number().int().optional(),
  currency: z.string().optional(),
  transactionType: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  category: z.string().optional(),
  rateOrigin: rateOriginSchema.optional(),
});

export const currencyPreparationSchema = z.object({
  code: z.string().length(3),
  name: z.string(),
  action: currencyPrepActionSchema,
  coverageFrom: z.string().optional(),
  coverageTo: z.string().optional(),
});

export const importPreviewSummarySchema = z.object({
  totalRows: z.number().int(),
  importableRows: z.number().int(),
  duplicateRows: z.number().int(),
  invalidRows: z.number().int(),
  emptyRows: z.number().int(),
  categoriesToCreate: z.number().int(),
  blocked: z.boolean(),
});

export const boundImportPreviewSchema = z.object({
  token: z.string().min(1),
  job: currencyJobSchema,
  binding: importPreviewBindingSchema,
  rows: z.array(importPreviewRowResultSchema),
  currencyPreparations: z.array(currencyPreparationSchema),
  summary: importPreviewSummarySchema,
});

export const commitTransactionImportRequestSchema = z.object({
  token: z.string().min(1),
  fileDigest: z.string().min(1),
});

export const commitTransactionImportResponseSchema = z.object({
  transactions: z.array(transactionSchema),
});

export type RateDirection = z.infer<typeof rateDirectionSchema>;
export type CurrencyPrepAction = z.infer<typeof currencyPrepActionSchema>;
export type MappedExternalRate = z.infer<typeof mappedExternalRateSchema>;
export type NativeRateFields = z.infer<typeof nativeRateFieldsSchema>;
export type MappedImportRow = z.infer<typeof mappedImportRowSchema>;
export type PreviewTransactionImportRequest = z.infer<typeof previewTransactionImportRequestSchema>;
export type BoundImportPreview = z.infer<typeof boundImportPreviewSchema>;
export type ImportPreviewRowResult = z.infer<typeof importPreviewRowResultSchema>;
export type CurrencyPreparation = z.infer<typeof currencyPreparationSchema>;
export type CommitTransactionImportRequest = z.infer<typeof commitTransactionImportRequestSchema>;
export type CommitTransactionImportResponse = z.infer<typeof commitTransactionImportResponseSchema>;
