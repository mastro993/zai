import { z } from "zod";

import { isoFractionDigits } from "@/lib/currency";

import { MAX_TRANSACTION_AMOUNT_MINOR, parseAmountToMinor } from "../lib/transaction";

export const TRANSACTION_TYPES = ["expense", "income"] as const;

const nullableStringSchema = z.string().nullable().optional();

export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);

export const rateVariantSchema = z.enum(["identity", "automatic", "manual", "pending"]);
export const rateOriginSchema = z.enum(["supplied", "manual"]);

export const transactionExchangeRateRevisionSchema = z.object({
  variant: rateVariantSchema,
  rateDate: z.string().min(1),
  sourceObservationDate: z.string().optional(),
  sourceCurrency: z.string().length(3),
  referenceCurrency: z.string().length(3),
  originalDecimal: z.string().optional(),
  coefficient: z.number().int().optional(),
  scale: z.number().int().nonnegative().optional(),
  origin: rateOriginSchema,
});

export const transactionFormSchema = z
  .object({
    description: z.string().trim().optional(),
    amount: z.string(),
    currency: z.string().length(3),
    transactionDate: z.string().min(1, "Date is required"),
    transactionType: transactionTypeSchema,
    transactionCategoryId: z.string().optional(),
    notes: z.string().trim().optional(),
    manualExchangeRate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const parsed = parseAmountToMinor(data.amount, isoFractionDigits(data.currency));
    if (!parsed.ok) {
      ctx.addIssue({
        code: "custom",
        message: parsed.message,
        path: ["amount"],
      });
      return;
    }

    if (parsed.minor > MAX_TRANSACTION_AMOUNT_MINOR) {
      ctx.addIssue({
        code: "custom",
        message: "Amount exceeds supported maximum",
        path: ["amount"],
      });
    }
  })
  .transform((data) => {
    const parsed = parseAmountToMinor(data.amount, isoFractionDigits(data.currency));
    const amount = parsed.ok ? parsed.minor : 0;
    const manualExchangeRate = data.manualExchangeRate?.trim();

    return {
      description: data.description,
      amount,
      currency: data.currency,
      transactionDate: data.transactionDate,
      transactionType: data.transactionType,
      transactionCategoryId: data.transactionCategoryId,
      notes: data.notes,
      manualExchangeRate: manualExchangeRate ? manualExchangeRate : undefined,
    };
  });

export const transactionListItemSchema = z.object({
  id: z.string().min(1),
  description: nullableStringSchema,
  transactionDate: z.string(),
  transactionType: z.string().min(1),
  transactionCategoryId: nullableStringSchema,
  notes: nullableStringSchema,
  convertedAmount: z.number().int().nullable(),
  convertedCurrency: z.string().length(3),
  complete: z.boolean(),
});

export const transactionSchema = z.object({
  id: z.string().min(1),
  description: nullableStringSchema,
  amount: z.number().int(),
  currency: z.string().length(3),
  transactionDate: z.string(),
  transactionType: z.string().min(1),
  transactionCategoryId: nullableStringSchema,
  notes: nullableStringSchema,
  exchangeRate: transactionExchangeRateRevisionSchema,
  convertedAmount: z.number().int().nullable(),
  convertedCurrency: z.string().length(3),
  complete: z.boolean(),
});

export const paginatedTransactionsSchema = z.object({
  data: z.array(transactionListItemSchema),
  page: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
});

export type TransactionFormInput = z.input<typeof transactionFormSchema>;
export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type TransactionListItem = z.infer<typeof transactionListItemSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionExchangeRateRevision = z.infer<typeof transactionExchangeRateRevisionSchema>;
export type PaginatedTransactions = z.infer<typeof paginatedTransactionsSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type RateVariant = z.infer<typeof rateVariantSchema>;
export type RateOrigin = z.infer<typeof rateOriginSchema>;
