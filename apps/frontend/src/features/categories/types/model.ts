import { z } from "zod";

export const CATEGORY_COLORS = [
  "#C55B26",
  "#C5C526",
  "#5BC526",
  "#26C55B",
  "#26C5C5",
  "#265BC5",
  "#5B26C5",
  "#C526C5",
  "#C5265B",
  "#737373",
] as const;

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[9];
export const CATEGORY_ROLES = ["spending", "income"] as const;

const nullableStringSchema = z.string().nullable().optional();

const categoryColorWireSchema = z.union([z.string(), z.null()]).transform((value) => {
  if (value == null || value === "") {
    return null;
  }

  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    return value.toUpperCase();
  }

  return null;
});

export const categoryRoleSchema = z.enum(CATEGORY_ROLES);

export const categoryFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    parentId: z.string().optional(),
    description: z.string().trim().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable()
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
  color: categoryColorWireSchema.optional(),
  role: categoryRoleSchema,
});

export const categorySchema = categoryBaseSchema.extend({
  parent: categoryBaseSchema.nullable().optional(),
});

const recurringCategoryImpactSchema = z.object({
  recurringTransactionId: z.string().min(1),
  description: z.string().min(1),
});

const budgetImpactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const categoryDeletionPreviewSchema = z.object({
  affectedRecurringTransactions: z.array(recurringCategoryImpactSchema),
  affectedBudgets: z.array(budgetImpactSchema),
  blockedByCurrentBudget: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
export type CategoryColor = string | null;
export type CategoryRole = z.infer<typeof categoryRoleSchema>;
export type TransactionCategory = z.infer<typeof categorySchema>;
export type CategoryChildrenDeleteStrategy = "block" | "promote" | "delete";
export type CategoryDeletionPreview = z.infer<typeof categoryDeletionPreviewSchema>;
