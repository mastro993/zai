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

export type TransactionCategoryColor =
  (typeof TransactionCategoryColors)[number];

export const TransactionCategorySchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  color: z.enum(TransactionCategoryColors).optional(),
});

export const TransactionCategoriesSchema = z.array(TransactionCategorySchema);

export type TransactionCategory = z.infer<typeof TransactionCategorySchema>;

export type TransactionCategories = z.infer<typeof TransactionCategoriesSchema>;

export const NewTransactionCategorySchema = TransactionCategorySchema.partial({
  id: true,
});

export const NewTransactionCategoriesSchema = z.array(
  NewTransactionCategorySchema
);

export type NewTransactionCategory = z.infer<
  typeof NewTransactionCategorySchema
>;

export type NewTransactionCategories = z.infer<
  typeof NewTransactionCategoriesSchema
>;
