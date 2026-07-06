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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { CategoryFormMode } from "./category-types";
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  categoryFormSchema,
  type CategoryFormValues,
  type TransactionCategory,
  isCategoryColor,
} from "./model";

const getFormDefaults = (mode: CategoryFormMode): CategoryFormValues => {
  if (mode.type === "create-root") {
    return {
      name: "",
      parentId: "",
      description: "",
      color: CATEGORY_COLORS[0],
    };
  }

  if (mode.type === "create-child") {
    return {
      name: "",
      parentId: mode.parentId,
      description: "",
      color: undefined,
    };
  }

  return {
    name: mode.category.name,
    parentId: mode.category.parentId ?? "",
    description: mode.category.description ?? "",
    color:
      mode.category.color && isCategoryColor(mode.category.color)
        ? mode.category.color
        : CATEGORY_COLORS[0],
  };
};

function CategoryFormDrawer({
  mode,
  categories,
  onSubmit,
}: {
  mode: CategoryFormMode;
  categories: Array<TransactionCategory>;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
}) {
  const categoriesWithChildren = new Set(
    categories
      .filter((category) => categories.some((child) => child.parentId === category.id))
      .map((category) => category.id),
  );
  const canChooseParent = mode.type !== "edit" || !categoriesWithChildren.has(mode.category.id);
  const rootOptions = categories.filter(
    (category) => !category.parentId && (mode.type !== "edit" || category.id !== mode.category.id),
  );
  const parentItems = [
    { label: "None", value: null },
    ...rootOptions.map((category) => ({ label: category.name, value: category.id })),
  ];
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: getFormDefaults(mode),
  });
  const parentId = useWatch({
    control: form.control,
    name: "parentId",
  });
  const selectedColor =
    useWatch({
      control: form.control,
      name: "color",
    }) ?? DEFAULT_CATEGORY_COLOR;
  const isChildCategory = Boolean(parentId);
  const title = mode.type === "edit" ? "Edit category" : "New category";
  const { errors, isSubmitting } = form.formState;

  return (
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
        <DrawerDescription>
          Names must be unique among categories at the same level.
        </DrawerDescription>
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
              aria-invalid={Boolean(errors.name)}
              {...form.register("name")}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>

          {canChooseParent ? (
            <Field>
              <FieldLabel>Parent category</FieldLabel>
              <Controller
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <Select
                    items={parentItems}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
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
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="category-description">Description</FieldLabel>
            <Input id="category-description" {...form.register("description")} />
          </Field>

          {!isChildCategory ? (
            <Field data-invalid={Boolean(errors.color)}>
              <FieldLabel>Color</FieldLabel>
              <input type="hidden" {...form.register("color")} />
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Select ${color}`}
                    aria-pressed={selectedColor === color}
                    className={cn(
                      "size-7 border",
                      selectedColor === color ? "ring-2 ring-ring" : null,
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      form.setValue("color", color, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                ))}
              </div>
              <FieldError>{errors.color?.message}</FieldError>
            </Field>
          ) : null}
        </FieldGroup>

        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting}>
            Save category
          </Button>
          <DrawerClose render={<Button type="button" variant="outline" />}>Cancel</DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}

export { CategoryFormDrawer };
