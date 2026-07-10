import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

import { suggestBudgetName } from "../lib/budget";
import { getCategoryDisplayName } from "../lib/category";
import {
  BUDGET_CADENCES,
  budgetFormSchema,
  type BudgetCadence,
  type BudgetFormInput,
  type BudgetFormValues,
} from "../types/budget-types";
import type { TransactionCategory } from "../types/model";
import { CategoryBadge } from "./category-badge";

const CADENCE_ITEMS = BUDGET_CADENCES.map((cadence) => ({
  label: cadence.charAt(0).toUpperCase() + cadence.slice(1),
  value: cadence,
}));

const getCategoryOptions = (categories: Array<TransactionCategory>) => {
  const roots = categories.filter((category) => !category.parentId);

  const categoryById = new Map(categories.map((category) => [category.id, category] as const));

  return roots.flatMap((root) => {
    const children = categories.filter((category) => category.parentId === root.id);
    const options = [
      {
        id: root.id,
        label: root.name,
        isRoot: true,
        color: root.color,
      },
    ];

    for (const child of children) {
      options.push({
        id: child.id,
        label: getCategoryDisplayName(child, categoryById),
        isRoot: false,
        color: child.color ?? root.color,
      });
    }

    return options;
  });
};

function BudgetFormDrawer({
  categories,
  onSubmit,
}: {
  categories: Array<TransactionCategory>;
  onSubmit: (values: BudgetFormValues) => Promise<void>;
}) {
  const categoryOptions = getCategoryOptions(categories);
  const form = useForm<BudgetFormInput, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      name: "",
      allowance: "0.00",
      cadence: "monthly",
      categoryIds: [],
    },
  });
  const watchedCategoryIds = useWatch({ control: form.control, name: "categoryIds" }) ?? [];
  const watchedName = useWatch({ control: form.control, name: "name" }) ?? "";
  const { errors, isSubmitting } = form.formState;

  const applySuggestedName = () => {
    const suggested = suggestBudgetName(categories, watchedCategoryIds);
    if (suggested) {
      form.setValue("name", suggested, { shouldDirty: true, shouldValidate: true });
    }
  };

  return (
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>New budget</DrawerTitle>
        <DrawerDescription>
          Set a recurring spending limit for one or more categories. The budget starts in the
          current period immediately.
        </DrawerDescription>
      </DrawerHeader>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <FieldGroup className="flex-1 overflow-y-auto p-4">
          <Field data-invalid={Boolean(errors.categoryIds)}>
            <FieldLabel>Category scope</FieldLabel>
            <div className="flex flex-col gap-2">
              {categoryOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create a category before setting up a budget.
                </p>
              ) : (
                categoryOptions.map((option) => {
                  const checked = watchedCategoryIds.includes(option.id);

                  return (
                    <label
                      key={option.id}
                      className="flex items-center gap-2 border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) => {
                          const nextIds = nextChecked
                            ? [...watchedCategoryIds, option.id]
                            : watchedCategoryIds.filter((id) => id !== option.id);
                          form.setValue("categoryIds", nextIds, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                      />
                      <CategoryBadge color={option.color ?? "#3D3D3D"}>
                        {option.label}
                      </CategoryBadge>
                    </label>
                  );
                })
              )}
            </div>
            <FieldError>{errors.categoryIds?.message}</FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="budget-name">Name</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="budget-name"
                autoFocus
                placeholder="Food budget"
                {...form.register("name")}
              />
              <Button type="button" variant="outline" onClick={applySuggestedName}>
                Suggest
              </Button>
            </div>
            <FieldDescription>
              {watchedName.trim() ? "You can rename the budget any time." : "Required."}
            </FieldDescription>
            <FieldError>{errors.name?.message}</FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.allowance)}>
            <FieldLabel htmlFor="budget-allowance">Allowance</FieldLabel>
            <Input id="budget-allowance" inputMode="decimal" {...form.register("allowance")} />
            <FieldDescription>
              Minor currency units are stored exactly. Zero is allowed.
            </FieldDescription>
            <FieldError>{errors.allowance?.message}</FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.cadence)}>
            <FieldLabel>Cadence</FieldLabel>
            <Controller
              control={form.control}
              name="cadence"
              render={({ field }) => (
                <Select
                  items={CADENCE_ITEMS}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as BudgetCadence)}
                >
                  <SelectTrigger className="w-full" aria-label="Budget cadence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {CADENCE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError>{errors.cadence?.message}</FieldError>
          </Field>
        </FieldGroup>

        <DrawerFooter>
          <Button type="submit" disabled={isSubmitting || categoryOptions.length === 0}>
            {isSubmitting ? "Saving..." : "Save budget"}
          </Button>
          <DrawerClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>
            Cancel
          </DrawerClose>
        </DrawerFooter>
      </form>
    </DrawerContent>
  );
}

export { BudgetFormDrawer };
