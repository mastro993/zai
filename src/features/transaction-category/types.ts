import * as z from "zod";

export const TransactionCategoryColors = [
  // Hard colors
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "sky",
  "blue",
  "indigo",
  "purple",
  "pink",
  "neutral",
  // Soft colors
  "red-soft",
  "orange-soft",
  "yellow-soft",
  "green-soft",
  "teal-soft",
  "sky-soft",
  "blue-soft",
  "indigo-soft",
  "purple-soft",
  "pink-soft",
  "neutral-soft",
] as const;

export type TransactionCategoryColor = (typeof TransactionCategoryColors)[number];

const _TransactionCategorySchema = z.object({
  id: z.string(),
  parentId: z.string().optional().nullable(),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional().nullable(),
  color: z.enum(TransactionCategoryColors),
});

export const TransactionCategorySchema = _TransactionCategorySchema.extend({
  parent: _TransactionCategorySchema.optional().nullable(),
});

export type TransactionCategory = z.infer<typeof TransactionCategorySchema>;

export const TransactionCategoriesSchema = z.array(TransactionCategorySchema);

export type TransactionCategories = z.infer<typeof TransactionCategoriesSchema>;

export const NewTransactionCategorySchema = _TransactionCategorySchema.partial({
  id: true,
});

export type NewTransactionCategory = z.infer<typeof NewTransactionCategorySchema>;

export const NewTransactionCategoriesSchema = z.array(NewTransactionCategorySchema);

export type NewTransactionCategories = z.infer<typeof NewTransactionCategoriesSchema>;
