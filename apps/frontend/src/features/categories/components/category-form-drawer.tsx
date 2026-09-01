import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  getCategoryDisplayColor,
  getCategoryDisplayIcon,
  getCategoryRoleLabel,
  isCategoryColor,
} from "../lib/category";
import { DEFAULT_CATEGORY_ICON } from "../lib/category-icon";
import type { CategoryFormMode } from "../types/category-types";
import {
  DEFAULT_CATEGORY_COLOR,
  categoryFormSchema,
  type CategoryFormValues,
  type TransactionCategory,
} from "../types/model";
import { CategoryBadge } from "./category-badge";
import { CategoryColorPicker } from "./category-color-picker";
import { CategoryIconPicker } from "./category-icon-picker";
import { CategoryParentCombobox } from "./category-parent-combobox";
import { CategoryRoleCombobox } from "./category-role-combobox";

const getFormDefaults = (mode: CategoryFormMode): CategoryFormValues => {
  if (mode.type === "create-root") {
    return {
      name: "",
      parentId: "",
      description: "",
      color: DEFAULT_CATEGORY_COLOR,
      icon: null,
      role: "spending",
    };
  }

  if (mode.type === "create-child") {
    return {
      name: "",
      parentId: mode.parentId,
      description: "",
      color: undefined,
      icon: null,
      role: undefined,
    };
  }

  return {
    name: mode.category.name,
    parentId: mode.category.parentId ?? "",
    description: mode.category.description ?? "",
    color: isCategoryColor(mode.category.color) ? mode.category.color : DEFAULT_CATEGORY_COLOR,
    icon: mode.category.icon ?? null,
    role: mode.category.parentId ? undefined : mode.category.role,
  };
};

const getFormCopy = (mode: CategoryFormMode) => {
  if (mode.type === "edit") {
    return {
      title: "Edit category",
      description: "Names must be unique among siblings.",
    };
  }

  if (mode.type === "create-child") {
    return {
      title: "New subcategory",
      description: "Names must be unique under this parent.",
    };
  }

  return {
    title: "New category",
    description: "Names must be unique among root categories.",
  };
};

function CategoryFormDrawer({
  open,
  mode,
  categories,
  onSubmit,
}: {
  open: boolean;
  mode: CategoryFormMode;
  categories: Array<TransactionCategory>;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
}) {
  const categoryById = new Map(categories.map((category) => [category.id, category] as const));
  const categoriesWithChildren = new Set(
    categories
      .filter((category) => categories.some((child) => child.parentId === category.id))
      .map((category) => category.id),
  );
  const canChooseParent = mode.type !== "edit" || !categoriesWithChildren.has(mode.category.id);
  const isCreateChild = mode.type === "create-child";
  const lockedParent = isCreateChild ? categoryById.get(mode.parentId) : undefined;
  const rootOptions = categories.filter(
    (category) => !category.parentId && (mode.type !== "edit" || category.id !== mode.category.id),
  );
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: getFormDefaults(mode),
  });
  const parentId = useWatch({ control: form.control, name: "parentId" });
  const selectedIcon = useWatch({ control: form.control, name: "icon" });
  const categoryName = useWatch({ control: form.control, name: "name" });
  const categoryDescription = useWatch({ control: form.control, name: "description" });
  const isChildCategory = Boolean(parentId);
  const parentCategory = parentId ? categoryById.get(parentId) : undefined;
  const effectiveIcon =
    selectedIcon ??
    (isChildCategory
      ? parentCategory
        ? getCategoryDisplayIcon(parentCategory)
        : DEFAULT_CATEGORY_ICON
      : DEFAULT_CATEGORY_ICON);
  const { title, description } = getFormCopy(mode);
  const { errors, isSubmitting } = form.formState;
  const nameErrorId = "category-name-error";
  const colorErrorId = "category-color-error";

  return (
    <DrawerContent className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem]">
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
        <DrawerDescription>{description}</DrawerDescription>
      </DrawerHeader>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <FieldGroup className="flex-1 overflow-y-auto p-4">
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="category-name">Name</FieldLabel>
            <Input
              id="category-name"
              autoFocus
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? nameErrorId : undefined}
              placeholder="Groceries"
              {...form.register("name")}
            />
            <FieldError id={nameErrorId}>{errors.name?.message}</FieldError>
          </Field>

          {isCreateChild && lockedParent ? (
            <Field>
              <FieldLabel>Parent category</FieldLabel>
              <div className="flex h-8 items-center rounded-lg border border-input px-2.5">
                <CategoryBadge color={getCategoryDisplayColor(lockedParent)}>
                  {lockedParent.name}
                </CategoryBadge>
              </div>
              <input type="hidden" {...form.register("parentId")} />
            </Field>
          ) : canChooseParent && rootOptions.length > 0 ? (
            <Field>
              <FieldLabel htmlFor="category-parent-trigger">Parent category</FieldLabel>
              <Controller
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <CategoryParentCombobox
                    id="category-parent-trigger"
                    categories={rootOptions}
                    value={field.value ? field.value : null}
                    parentOpen={open}
                    onBlur={field.onBlur}
                    onChange={(nextParentId) => {
                      field.onChange(nextParentId ?? "");

                      if (nextParentId) {
                        form.setValue("role", undefined, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        form.setValue("color", undefined, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        return;
                      }

                      const currentColor = form.getValues("color");
                      if (!form.getValues("role")) {
                        form.setValue("role", "spending", {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                      if (currentColor === undefined) {
                        form.setValue("color", DEFAULT_CATEGORY_COLOR, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                    }}
                  />
                )}
              />
              <FieldDescription>Only one nesting level.</FieldDescription>
            </Field>
          ) : null}

          {isChildCategory ? (
            <Field>
              <FieldLabel>Role</FieldLabel>
              <div className="flex h-8 items-center rounded-lg border border-input px-2.5 text-xs">
                {getCategoryRoleLabel(
                  parentCategory?.role ?? (mode.type === "edit" ? mode.category.role : "spending"),
                )}
              </div>
            </Field>
          ) : (
            <Field data-invalid={Boolean(errors.role)}>
              <FieldLabel htmlFor="category-role">Role</FieldLabel>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <CategoryRoleCombobox
                    id="category-role"
                    value={field.value}
                    parentOpen={open}
                    invalid={Boolean(errors.role)}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <FieldError>{errors.role?.message}</FieldError>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="category-description">Description</FieldLabel>
            <Textarea
              id="category-description"
              placeholder="Optional"
              className="min-h-16 resize-y"
              {...form.register("description")}
            />
          </Field>

          <Field>
            <FieldLabel>Icon</FieldLabel>
            <Controller
              control={form.control}
              name="icon"
              render={({ field }) => (
                <CategoryIconPicker
                  value={field.value ?? null}
                  effectiveIcon={effectiveIcon}
                  isChild={isChildCategory}
                  name={categoryName}
                  description={categoryDescription ?? ""}
                  onChange={(icon) =>
                    field.onChange(icon, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              )}
            />
            {isChildCategory ? null : (
              <FieldDescription>Children inherit this unless they pick their own.</FieldDescription>
            )}
          </Field>

          {!isChildCategory ? (
            <Field data-invalid={Boolean(errors.color)}>
              <FieldLabel>Color</FieldLabel>
              <Controller
                control={form.control}
                name="color"
                render={({ field }) => (
                  <CategoryColorPicker
                    value={field.value ?? DEFAULT_CATEGORY_COLOR}
                    icon={effectiveIcon}
                    onChange={(color) =>
                      field.onChange(color, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                )}
              />
              <FieldError id={colorErrorId}>{errors.color?.message}</FieldError>
            </Field>
          ) : null}
        </FieldGroup>

        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save category"}
          </Button>
          <DrawerClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>
            Cancel
          </DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}

export { CategoryFormDrawer };
