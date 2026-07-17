import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState } from "react";
import { type Control, useController } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import { Field, FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";

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
}

const EMPTY_CATEGORY_IDS: Array<string> = [];

function BudgetCategoryScopeField({
  categories,
  control,
  formOpen,
}: BudgetCategoryScopeFieldProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { field } = useController({ control, name: "categoryIds" });
  const selectedIds = field.value ?? EMPTY_CATEGORY_IDS;
  const selectionItems = useMemo(
    () => getCategorySelectionItems(categories, selectedIds),
    [categories, selectedIds],
  );
  const visibleItems = selectionItems.slice(0, 2);
  const hiddenItemCount = selectionItems.length - visibleItems.length;

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
      <FieldDescription>
        Leave empty to include all transactions. Root categories include their subcategories.
      </FieldDescription>
      <Field>
        <Drawer open={isDrawerOpen} onOpenChange={handleOpenChange} swipeDirection="right">
          <DrawerTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-8 w-full justify-between overflow-hidden py-1.5 font-normal"
                aria-label="Choose categories"
                aria-describedby="budget-category-selection-summary"
              />
            }
          >
            <span
              id="budget-category-selection-summary"
              className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
            >
              {selectionItems.length === 0 ? (
                <span className="truncate text-muted-foreground">All categories</span>
              ) : (
                visibleItems.map((category) => (
                  <CategoryBadge key={category.id} color={getCategoryDisplayColor(category)}>
                    {category.name}
                  </CategoryBadge>
                ))
              )}
              {hiddenItemCount > 0 ? <Badge variant="secondary">+{hiddenItemCount}</Badge> : null}
            </span>
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" aria-hidden="true" />
          </DrawerTrigger>
          <BudgetCategorySelectionDrawer
            open={isDrawerOpen}
            categories={categories}
            selectedIds={selectedIds}
            onSelectedIdsChange={field.onChange}
          />
        </Drawer>
      </Field>
    </FieldSet>
  );
}

export { BudgetCategoryScopeField };
