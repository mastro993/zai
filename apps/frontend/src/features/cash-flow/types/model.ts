import { z } from "zod";

export const CATEGORY_COLORS = [
  "#E53935",
  "#FB8C00",
  "#FDD835",
  "#43A047",
  "#00ACC1",
  "#1E88E5",
  "#5E35B1",
  "#8E24AA",
  "#D81B60",
  "#757575",
] as const;

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0];
export const TRANSACTION_TYPES = ["expense", "income"] as const;

const nullableStringSchema = z.string().nullable().optional();
const categoryColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Select a valid category color")
  .transform((value) => value.toUpperCase());

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  parentId: z.string().optional(),
  description: z.string().trim().optional(),
  color: z
    .string()
    .regex(/^#?[0-9a-f]{6}$/i)
    .optional(),
});

const categoryBaseSchema = z.object({
  id: z.string().min(1),
  parentId: nullableStringSchema,
  name: z.string().min(1),
  description: nullableStringSchema,
  color: categoryColorSchema.nullable().optional(),
});

export const categorySchema = categoryBaseSchema.extend({
  parent: categoryBaseSchema.nullable().optional(),
});

export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);

const amountInputSchema = z
  .string()
  .trim()
  .min(1, "Amount is required")
  .refine((value) => {
    const normalized = value.replace(",", ".");

    return /^\d+(\.\d{1,2})?$/.test(normalized);
  }, "Enter a valid amount")
  .refine((value) => {
    const parsed = Number(value.replace(",", "."));

    return Number.isFinite(parsed) && parsed >= 0;
  }, "Amount must be zero or greater")
  .transform((value) => Math.round(Number(value.replace(",", ".")) * 100));

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

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];
export type TransactionCategory = z.infer<typeof categorySchema>;
export type TransactionFormInput = z.input<typeof transactionFormSchema>;
export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type PaginatedTransactions = z.infer<typeof paginatedTransactionsSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type CategoryChildrenDeleteStrategy = "block" | "promote" | "delete";
