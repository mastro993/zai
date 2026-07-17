import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { type Control, Controller, useController, type FieldError } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
const VISIBLE_BADGE_LIMIT = 3;

function BudgetCategoryScopeField({
  categories,
  control,
  formOpen,
  error,
}: BudgetCategoryScopeFieldProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { field: categoryIdsField } = useController({ control, name: "categoryIds" });
  const selectedIds = categoryIdsField.value ?? EMPTY_CATEGORY_IDS;
  const selectionItems = useMemo(
    () => getCategorySelectionItems(categories, selectedIds),
    [categories, selectedIds],
  );
  const visibleItems = selectionItems.slice(0, VISIBLE_BADGE_LIMIT);
  const hiddenItemCount = selectionItems.length - visibleItems.length;
  const categoryErrorId = "budget-category-scope-error";

  useEffect(() => {
    if (!formOpen) setIsDrawerOpen(false);
  }, [formOpen]);

  const handleOpenChange = (open: boolean) => {
    setIsDrawerOpen(open);
    if (!open) categoryIdsField.onBlur();
  };

  return (
    <FieldSet>
      <FieldLegend>Category scope</FieldLegend>
      <Controller
        control={control}
        name="categoryScope"
        render={({ field: scopeField }) => {
          const scope = scopeField.value ?? (selectedIds.length > 0 ? "specific" : "all");

          return (
            <FieldGroupBlock>
              <ToggleGroup
                aria-label="Category scope"
                aria-describedby="budget-category-scope-description"
                className="w-full"
                spacing={0}
                variant="outline"
                value={[scope]}
                onValueChange={(values) => {
                  const value = values.at(-1);
                  if (value !== "all" && value !== "specific") return;
                  scopeField.onChange(value);
                  if (value === "all") {
                    categoryIdsField.onChange([]);
                    setIsDrawerOpen(false);
                    return;
                  }
                  if (selectedIds.length === 0) setIsDrawerOpen(true);
                }}
              >
                <ToggleGroupItem value="all" className="flex-1">
                  All categories
                </ToggleGroupItem>
                <ToggleGroupItem value="specific" className="flex-1">
                  Specific
                </ToggleGroupItem>
              </ToggleGroup>

              <FieldDescription id="budget-category-scope-description">
                {scope === "all"
                  ? "Every transaction counts toward this budget."
                  : "Only selected categories count. Roots include their subcategories."}
              </FieldDescription>

              {scope === "specific" ? (
                <Field data-invalid={Boolean(error)} className="min-w-0">
                  <Drawer
                    open={isDrawerOpen}
                    onOpenChange={handleOpenChange}
                    swipeDirection="right"
                  >
                    <DrawerTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto min-h-8 w-full min-w-0 justify-between gap-2 overflow-hidden py-1.5 font-normal"
                          aria-label={
                            selectionItems.length === 0
                              ? "Choose categories"
                              : `Choose categories, ${selectionItems.length} selected`
                          }
                          aria-describedby={`budget-category-scope-description budget-category-selection-summary${error ? ` ${categoryErrorId}` : ""}`}
                          aria-invalid={Boolean(error)}
                        />
                      }
                    >
                      <span
                        id="budget-category-selection-summary"
                        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
                      >
                        {selectionItems.length === 0 ? (
                          <span className="truncate text-muted-foreground">Choose categories…</span>
                        ) : (
                          <>
                            {visibleItems.map((category) => (
                              <CategoryBadge
                                key={category.id}
                                color={getCategoryDisplayColor(category)}
                                className="min-w-0 max-w-[5.5rem] shrink"
                              >
                                {category.name}
                              </CategoryBadge>
                            ))}
                            {hiddenItemCount > 0 ? (
                              <Badge variant="secondary" className="shrink-0">
                                +{hiddenItemCount}
                              </Badge>
                            ) : null}
                          </>
                        )}
                      </span>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="shrink-0"
                        data-icon="inline-end"
                        aria-hidden="true"
                      />
                    </DrawerTrigger>
                    <BudgetCategorySelectionDrawer
                      open={isDrawerOpen}
                      categories={categories}
                      selectedIds={selectedIds}
                      onSelectedIdsChange={categoryIdsField.onChange}
                    />
                  </Drawer>
                  <FieldErrorMessage id={categoryErrorId} errors={[error]} />
                </Field>
              ) : null}
            </FieldGroupBlock>
          );
        }}
      />
    </FieldSet>
  );
}

function FieldGroupBlock({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-3">{children}</div>;
}

export { BudgetCategoryScopeField };
