import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { DrawerSelect } from "@/components/drawer-select";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { getCategoryDisplayColor, getCategoryRoleLabel, isCategoryColor } from "../lib/category";
import type { CategoryFormMode } from "../types/category-types";
import {
  DEFAULT_CATEGORY_COLOR,
  categoryFormSchema,
  type CategoryFormValues,
  type CategoryRole,
  type TransactionCategory,
} from "../types/model";
import { CategoryBadge } from "./category-badge";
import { CategoryColorPicker } from "./category-color-picker";
import { CATEGORY_ROLE_OPTIONS } from "./category-role-options";

const getFormDefaults = (mode: CategoryFormMode): CategoryFormValues => {
  if (mode.type === "create-root") {
    return {
      name: "",
      parentId: "",
      description: "",
      color: DEFAULT_CATEGORY_COLOR,
      role: "spending",
    };
  }

  if (mode.type === "create-child") {
    return {
      name: "",
      parentId: mode.parentId,
      description: "",
      color: undefined,
      role: undefined,
    };
  }

  return {
    name: mode.category.name,
    parentId: mode.category.parentId ?? "",
    description: mode.category.description ?? "",
    color:
      mode.category.color && isCategoryColor(mode.category.color)
        ? mode.category.color
        : DEFAULT_CATEGORY_COLOR,
    role: mode.category.parentId ? undefined : mode.category.role,
  };
};

const getFormCopy = (mode: CategoryFormMode) => {
  if (mode.type === "edit") {
    return {
      title: "Edit category",
      description:
        "Update the name, role, parent, or color. Names must stay unique at the same level.",
    };
  }

  if (mode.type === "create-child") {
    return {
      title: "New subcategory",
      description:
        "Subcategories inherit their parent color in lists and reports. Pick a clear, specific name.",
    };
  }

  return {
    title: "New category",
    description:
      "Choose whether this category tracks spending or income. Names must be unique among other root categories.",
  };
};

function CategoryFormPreview({
  name,
  description,
  displayColor,
  parentName,
}: {
  name: string;
  description: string;
  displayColor: string;
  parentName?: string;
}) {
  const previewName = name.trim() || "Category name";
  const previewDescription = description.trim();
  const isPlaceholderName = !name.trim();

  return (
    <div className="border bg-muted/40 px-3 py-2.5">
      <p className="mb-2 text-xs font-medium text-muted-foreground">List preview</p>
      <div className="flex min-w-0 flex-col gap-1">
        <CategoryBadge color={displayColor} className={isPlaceholderName ? "italic" : undefined}>
          {parentName ? `${parentName} / ${previewName}` : previewName}
        </CategoryBadge>
        {previewDescription ? (
          <span className="truncate text-xs text-muted-foreground">{previewDescription}</span>
        ) : null}
      </div>
    </div>
  );
}

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
  const parentItems = [
    { label: "None", value: null },
    ...rootOptions.map((category) => ({
      label: category.name,
      value: category.id,
    })),
  ];
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: getFormDefaults(mode),
  });
  const watchedName = useWatch({ control: form.control, name: "name" }) ?? "";
  const watchedDescription = useWatch({ control: form.control, name: "description" }) ?? "";
  const parentId = useWatch({ control: form.control, name: "parentId" });
  const selectedColor =
    useWatch({
      control: form.control,
      name: "color",
    }) ?? DEFAULT_CATEGORY_COLOR;
  const isChildCategory = Boolean(parentId);
  const parentCategory = parentId ? categoryById.get(parentId) : undefined;
  const previewColor = isChildCategory
    ? getCategoryDisplayColor({
        id: "preview",
        parentId: parentId || null,
        name: watchedName,
        color: null,
        role: parentCategory?.role ?? "spending",
        parent: parentCategory ?? null,
      })
    : selectedColor;
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
            <FieldDescription>
              Required. Shown in transaction lists and category reports.
            </FieldDescription>
            <FieldError id={nameErrorId}>{errors.name?.message}</FieldError>
          </Field>

          {isCreateChild && lockedParent ? (
            <Field>
              <FieldLabel>Parent category</FieldLabel>
              <div className="flex h-8 items-center border border-input px-2.5">
                <CategoryBadge color={getCategoryDisplayColor(lockedParent)}>
                  {lockedParent.name}
                </CategoryBadge>
              </div>
              <FieldDescription>Subcategories stay under this parent.</FieldDescription>
              <input type="hidden" {...form.register("parentId")} />
            </Field>
          ) : canChooseParent ? (
            <Field>
              <FieldLabel>Parent category</FieldLabel>
              <Controller
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <Select
                    items={parentItems}
                    value={field.value || null}
                    onValueChange={(value) => {
                      const nextParentId = value ?? "";
                      field.onChange(nextParentId);

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
                      if (!currentColor) {
                        form.setValue("color", DEFAULT_CATEGORY_COLOR, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label="Parent category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {parentItems.map((item) => (
                          <SelectItem key={item.value ?? "none"} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>
                Leave as none for a root category, or nest one level under an existing root.
              </FieldDescription>
            </Field>
          ) : null}

          {isChildCategory ? (
            <Field>
              <FieldLabel>Role</FieldLabel>
              <div className="flex h-8 items-center border border-input px-2.5 text-xs">
                {getCategoryRoleLabel(
                  parentCategory?.role ?? (mode.type === "edit" ? mode.category.role : "spending"),
                )}
              </div>
              <FieldDescription>
                Child categories inherit their root category role.
              </FieldDescription>
            </Field>
          ) : (
            <Field data-invalid={Boolean(errors.role)}>
              <FieldLabel htmlFor="category-role">Role</FieldLabel>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <DrawerSelect<CategoryRole>
                    id="category-role"
                    ariaLabel="Category role"
                    drawerTitle="Role"
                    drawerDescription="Choose whether this category tracks spending or income."
                    placeholder="Select a role"
                    value={field.value ?? null}
                    options={CATEGORY_ROLE_OPTIONS}
                    parentOpen={open}
                    backAriaLabel="Back to category"
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <FieldDescription>
                Income categories identify genuine income; spending categories can include refunds.
              </FieldDescription>
              <FieldError>{errors.role?.message}</FieldError>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="category-description">Description</FieldLabel>
            <Textarea
              id="category-description"
              placeholder="Optional note for your own reference"
              className="min-h-16 resize-y"
              {...form.register("description")}
            />
          </Field>

          {!isChildCategory ? (
            <Field data-invalid={Boolean(errors.color)}>
              <FieldLabel>Color</FieldLabel>
              <input type="hidden" {...form.register("color")} />
              <Controller
                control={form.control}
                name="color"
                render={({ field }) => (
                  <CategoryColorPicker
                    value={(field.value as string | undefined) ?? DEFAULT_CATEGORY_COLOR}
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

          <CategoryFormPreview
            name={watchedName}
            description={watchedDescription}
            displayColor={previewColor}
            parentName={lockedParent?.name ?? parentCategory?.name}
          />
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
