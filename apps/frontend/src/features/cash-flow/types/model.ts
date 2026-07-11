import { z } from "zod";

import { prepareAmountForValidation } from "../lib/transaction";

const CATEGORY_COLOR_PAIRS = [
  ["#951818", "#F6CACA"],
  ["#884416", "#F6DCCA"],
  ["#6C560F", "#F8EDC9"],
  ["#147B1E", "#CAF6CF"],
  ["#156D7F", "#CAEFF6"],
  ["#184E95", "#CADDF6"],
  ["#291895", "#D0CAF6"],
  ["#701895", "#E9CAF6"],
  ["#95185F", "#F6CAE3"],
  ["#3D3D3D", "#E6E6E6"],
] as const;

export const CATEGORY_DARK_COLORS = CATEGORY_COLOR_PAIRS.map(([darkColor]) => darkColor);

export const CATEGORY_LIGHT_COLORS = CATEGORY_COLOR_PAIRS.map(([, lightColor]) => lightColor);

export const CATEGORY_COLORS = [...CATEGORY_DARK_COLORS, ...CATEGORY_LIGHT_COLORS];

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0];
export const TRANSACTION_TYPES = ["expense", "income"] as const;
export const CATEGORY_ROLES = ["spending", "income"] as const;

const nullableStringSchema = z.string().nullable().optional();
const categoryColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Select a valid category color")
  .transform((value) => value.toUpperCase());

export const categoryRoleSchema = z.enum(CATEGORY_ROLES);

export const categoryFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    parentId: z.string().optional(),
    description: z.string().trim().optional(),
    color: z
      .string()
      .regex(/^#?[0-9a-f]{6}$/i)
      .optional(),
    role: categoryRoleSchema.optional(),
  })
  .superRefine((values, context) => {
    if (values.parentId && values.role) {
      context.addIssue({
        code: "custom",
        path: ["role"],
        message: "Child categories inherit their root category role",
      });
    } else if (!values.parentId && !values.role) {
      context.addIssue({
        code: "custom",
        path: ["role"],
        message: "Role is required for root categories",
      });
    }
  });

const categoryBaseSchema = z.object({
  id: z.string().min(1),
  parentId: nullableStringSchema,
  name: z.string().min(1),
  description: nullableStringSchema,
  color: categoryColorSchema.nullable().optional(),
  role: categoryRoleSchema,
});

export const categorySchema = categoryBaseSchema.extend({
  parent: categoryBaseSchema.nullable().optional(),
});

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
  );

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
export type CategoryRole = z.infer<typeof categoryRoleSchema>;
export type TransactionCategory = z.infer<typeof categorySchema>;
export type TransactionFormInput = z.input<typeof transactionFormSchema>;
export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type PaginatedTransactions = z.infer<typeof paginatedTransactionsSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type CategoryChildrenDeleteStrategy = "block" | "promote" | "delete";
