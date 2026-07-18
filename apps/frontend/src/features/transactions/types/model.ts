import { z } from "zod";

import { MAX_TRANSACTION_AMOUNT_MINOR, prepareAmountForValidation } from "../lib/transaction";

export const TRANSACTION_TYPES = ["expense", "income"] as const;

const nullableStringSchema = z.string().nullable().optional();

export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);

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

export const transactionFormSchema = z.object({
  description: z.string().trim().optional(),
  amount: amountInputSchema,
  transactionDate: z.string().min(1, "Date is required"),
  transactionType: transactionTypeSchema,
  transactionCategoryId: z.string().optional(),
  notes: z.string().trim().optional(),
});

export const transactionSchema = z.object({
  id: z.string().min(1),
  description: nullableStringSchema,
  amount: z.number().int(),
  transactionDate: z.string(),
  transactionType: z.string().min(1),
  transactionCategoryId: nullableStringSchema,
  notes: nullableStringSchema,
});

export const paginatedTransactionsSchema = z.object({
  data: z.array(transactionSchema),
  page: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
});

export type TransactionFormInput = z.input<typeof transactionFormSchema>;
export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type PaginatedTransactions = z.infer<typeof paginatedTransactionsSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
