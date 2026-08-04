import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";

import { CategoryBadge } from "@/features/categories/components/category-badge";
import {
  getCategoryDisplayColor,
  getCategoryDisplayName,
} from "@/features/categories/lib/category";
import type { TransactionCategory } from "@/features/categories/types/model";

interface UncategorizedOption {
  kind: "uncategorized";
  value: "";
  label: "Uncategorized";
}

interface CategoryOption {
  kind: "category";
  value: string;
  label: string;
  category: TransactionCategory;
}

type TransactionCategoryOption = UncategorizedOption | CategoryOption;

interface TransactionCategoryComboboxProps {
  id: string;
  categories: Array<TransactionCategory>;
  value: string | null;
  parentOpen: boolean;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
}

const UNCATEGORIZED_OPTION: UncategorizedOption = {
  kind: "uncategorized",
  value: "",
  label: "Uncategorized",
};

function TransactionCategoryCombobox({
  id,
  categories,
  value,
  parentOpen,
  onChange,
  onBlur,
}: TransactionCategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories],
  );
  const items = useMemo<Array<TransactionCategoryOption>>(
    () => [
      UNCATEGORIZED_OPTION,
      ...categories.map((category) => ({
        kind: "category" as const,
        value: category.id,
        label: getCategoryDisplayName(category, categoriesById),
        category,
      })),
    ],
    [categories, categoriesById],
  );
  const selected = value ? (items.find((item) => item.value === value) ?? null) : null;

  useEffect(() => {
    if (!parentOpen) setOpen(false);
  }, [parentOpen]);

  return (
    <Combobox<TransactionCategoryOption>
      items={items}
      value={selected}
      open={open}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) onBlur?.();
      }}
      onValueChange={(nextOption) => {
        onChange(nextOption?.kind === "category" ? nextOption.value : null);
      }}
    >
      <ComboboxTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-label="Choose category"
            className="h-auto min-h-8 w-full min-w-0 justify-between gap-2 overflow-hidden py-1.5 font-normal"
          />
        }
      >
        <ComboboxValue>
          {selected?.kind === "category" ? (
            <CategoryBadge color={getCategoryDisplayColor(selected.category)}>
              {selected.label}
            </CategoryBadge>
          ) : (
            <span className="text-muted-foreground">Uncategorized</span>
          )}
        </ComboboxValue>
      </ComboboxTrigger>

      <ComboboxContent aria-label="Select category">
        <ComboboxInput
          aria-label="Search categories"
          placeholder="Search categories"
          autoFocus
          showTrigger={false}
        />
        {categories.length === 0 ? (
          <p className="border-b px-3 py-2 text-sm text-muted-foreground">
            No categories yet.{" "}
            <Link
              to="/cash-flow/categories"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              Manage categories
            </Link>
          </p>
        ) : (
          <ComboboxEmpty>No categories match.</ComboboxEmpty>
        )}
        <ComboboxList>
          {(option) => (
            <ComboboxItem
              key={option.value || "uncategorized"}
              value={option}
              className="py-2.5 pl-2"
            >
              {option.kind === "category" ? (
                <CategoryBadge color={getCategoryDisplayColor(option.category)}>
                  {option.label}
                </CategoryBadge>
              ) : (
                <span className="px-1.5 text-muted-foreground">{option.label}</span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export { TransactionCategoryCombobox };
