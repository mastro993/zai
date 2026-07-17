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
  FieldLegend,
  FieldSet,
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

  useEffect(() => {
    if (!formOpen) setIsDrawerOpen(false);
  }, [formOpen]);

  const handleOpenChange = (open: boolean) => {
    setIsDrawerOpen(open);
    if (!open) field.onBlur();
  };

  return (
    <FieldSet>
      <FieldLegend>Category scope</FieldLegend>
      <FieldDescription id="budget-category-scope-description">
        Empty includes all transactions. Roots include their subcategories.
      </FieldDescription>
      <Field data-invalid={Boolean(error)} className="min-w-0">
        <Drawer open={isDrawerOpen} onOpenChange={handleOpenChange} swipeDirection="right">
          <DrawerTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-8 w-full min-w-0 justify-between gap-2 overflow-hidden py-1.5 font-normal"
                aria-label={
                  selectionItems.length === 0
                    ? "Choose categories, all categories"
                    : `Choose categories, ${selectionItems.length} selected`
                }
                aria-describedby={`budget-category-scope-description budget-category-selection-summary${error ? ` ${categoryErrorId}` : ""}`}
                aria-invalid={Boolean(error)}
              />
            }
          >
            <span
              id="budget-category-selection-summary"
              className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
            >
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
        <FieldErrorMessage id={categoryErrorId} errors={[error]} />
      </Field>
    </FieldSet>
  );
}

export { BudgetCategoryScopeField };
