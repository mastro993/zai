import * as z from "zod";
import { normalizeHexColor } from "@/utils/color";

const isTransactionCategoryColor = (color: string) => {
  try {
    normalizeHexColor(color);
    return true;
  } catch {
    return false;
  }
};

export const TransactionCategoryColorSchema = z
  .string()
  .trim()
  .refine(isTransactionCategoryColor, "Color must be a valid hex value")
  .transform(normalizeHexColor);

export type TransactionCategoryColor = z.infer<typeof TransactionCategoryColorSchema>;

export const TransactionCategoryOptionalColorSchema =
  TransactionCategoryColorSchema.nullish().transform((color) => color ?? undefined);

export type TransactionCategoryOptionalColor = z.infer<
  typeof TransactionCategoryOptionalColorSchema
>;

const _TransactionCategorySchema = z.object({
  id: z.string(),
  parentId: z.string().optional().nullable(),
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional().nullable(),
  color: TransactionCategoryOptionalColorSchema,
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
