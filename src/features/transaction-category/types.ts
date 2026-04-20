import * as z from "zod";

export const TransactionCategoryColors = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "pink",
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
