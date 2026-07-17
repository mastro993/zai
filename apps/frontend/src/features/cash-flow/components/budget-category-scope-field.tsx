import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState } from "react";
import { type Control, useController, type FieldError } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";

import { getCategoryDisplayColor } from "../lib/category";
import type { BudgetFormInput, BudgetFormValues } from "../types/budget";
import type { TransactionCategory } from "../types/model";
import { CategoryBadge } from "./category-badge";
import {
  BudgetCategorySelectionDrawer,
  getCategorySelectionItems,
} from "./budget-category-selection-drawer";

interface BudgetCategoryScopeFieldProps {
  categories: Array<TransactionCategory>;
  control: Control<BudgetFormInput, unknown, BudgetFormValues>;
  formOpen: boolean;
  error?: FieldError;
}

const EMPTY_CATEGORY_IDS: Array<string> = [];

function BudgetCategoryScopeField({
  categories,
  control,
  formOpen,
  error,
}: BudgetCategoryScopeFieldProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { field } = useController({ control, name: "categoryIds" });
  const selectedIds = field.value ?? EMPTY_CATEGORY_IDS;
  const selectionItems = useMemo(
    () => getCategorySelectionItems(categories, selectedIds),
    [categories, selectedIds],
  );
  const categoryErrorId = "budget-category-scope-error";
  const categoryDescriptionId = "budget-category-scope-description";
  const summaryId = "budget-category-selection-summary";

  useEffect(() => {
    if (!formOpen) setIsDrawerOpen(false);
  }, [formOpen]);

  const handleOpenChange = (open: boolean) => {
    setIsDrawerOpen(open);
    if (!open) field.onBlur();
  };

  return (
    <Field data-invalid={Boolean(error)} className="min-w-0">
      <FieldLabel htmlFor="budget-categories-trigger">Categories</FieldLabel>
      <Drawer open={isDrawerOpen} onOpenChange={handleOpenChange} swipeDirection="right">
        <DrawerTrigger
          render={
            <Button
              id="budget-categories-trigger"
              type="button"
              variant="outline"
              className="h-auto min-h-8 w-full min-w-0 justify-between gap-2 overflow-hidden py-1.5 font-normal"
              aria-label={
                selectionItems.length === 0
                  ? "Choose categories, all categories"
                  : `Choose categories, ${selectionItems.length} selected`
              }
              aria-describedby={`${categoryDescriptionId} ${summaryId}${error ? ` ${categoryErrorId}` : ""}`}
              aria-invalid={Boolean(error)}
            />
          }
        >
          <span id={summaryId} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {selectionItems.length === 0 ? (
              <span className="text-muted-foreground">All categories</span>
            ) : (
              selectionItems.map(({ category, label }) => (
                <CategoryBadge
                  key={category.id}
                  color={getCategoryDisplayColor(category)}
                  truncate={false}
                  className="max-w-full shrink"
                >
                  {label}
                </CategoryBadge>
              ))
            )}
          </span>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="shrink-0 self-center"
            data-icon="inline-end"
            aria-hidden="true"
          />
        </DrawerTrigger>
        <BudgetCategorySelectionDrawer
          open={isDrawerOpen}
          categories={categories}
          selectedIds={selectedIds}
          onSelectedIdsChange={field.onChange}
        />
      </Drawer>
      <FieldDescription id={categoryDescriptionId}>
        Empty includes all transactions. Roots include their subcategories.
      </FieldDescription>
      <FieldErrorMessage id={categoryErrorId} errors={[error]} />
    </Field>
  );
}

export { BudgetCategoryScopeField };
