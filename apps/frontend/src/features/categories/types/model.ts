import { z } from "zod";

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
export const CATEGORY_ROLES = ["spending", "income"] as const;

const nullableStringSchema = z.string().nullable().optional();

// Wire decode: tolerate legacy named colors (e.g. "orange") so one bad row
// cannot take down get_transaction_categories.
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
export type CategoryColor = (typeof CATEGORY_COLORS)[number];
export type CategoryRole = z.infer<typeof categoryRoleSchema>;
export type TransactionCategory = z.infer<typeof categorySchema>;
export type CategoryChildrenDeleteStrategy = "block" | "promote" | "delete";
export type CategoryDeletionPreview = z.infer<typeof categoryDeletionPreviewSchema>;
