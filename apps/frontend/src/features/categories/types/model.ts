import { z } from "zod";

export const CATEGORY_HUES = [20, 60, 100, 140, 180, 220, 260, 300, 340] as const;

export const DEFAULT_CATEGORY_HUE = null;
export const CATEGORY_ROLES = ["spending", "income"] as const;

const nullableStringSchema = z.string().nullable().optional();

const categoryHueWireSchema = z
  .preprocess(
    (value) =>
      value === null || value === ""
        ? null
        : typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 360
          ? value
          : undefined,
    z.union([z.number().int().min(0).max(360), z.null()]).optional(),
  )
  .transform((value) => (value == null ? null : value === 360 ? 0 : value));

export const categoryRoleSchema = z.enum(CATEGORY_ROLES);

export const categoryFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    parentId: z.string().optional(),
    description: z.string().trim().optional(),
    hue: z.number().int().min(0).max(360).nullable().optional(),
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
  hue: categoryHueWireSchema,
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
export type CategoryHue = number | null;
export type CategoryRole = z.infer<typeof categoryRoleSchema>;
export type TransactionCategory = z.infer<typeof categorySchema>;
export type CategoryChildrenDeleteStrategy = "block" | "promote" | "delete";
export type CategoryDeletionPreview = z.infer<typeof categoryDeletionPreviewSchema>;
