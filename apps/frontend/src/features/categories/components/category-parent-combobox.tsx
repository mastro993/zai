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

import { getCategoryDisplayColor } from "../lib/category";
import type { TransactionCategory } from "../types/model";
import { CategoryBadge } from "./category-badge";

interface CategoryParentOption {
  kind: "none" | "category";
  value: string;
  label: string;
  category?: TransactionCategory;
}

interface CategoryParentComboboxProps {
  id: string;
  categories: Array<TransactionCategory>;
  value: string | null;
  parentOpen: boolean;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
}

const NONE_OPTION: CategoryParentOption = {
  kind: "none",
  value: "",
  label: "None",
};

function CategoryParentCombobox({
  id,
  categories,
  value,
  parentOpen,
  onChange,
  onBlur,
}: CategoryParentComboboxProps) {
  const [open, setOpen] = useState(false);
  const items = useMemo<Array<CategoryParentOption>>(
    () => [
      NONE_OPTION,
      ...categories.map((category) => ({
        kind: "category" as const,
        value: category.id,
        label: category.name,
        category,
      })),
    ],
    [categories],
  );
  const selected = value ? (items.find((item) => item.value === value) ?? null) : null;

  useEffect(() => {
    if (!parentOpen) setOpen(false);
  }, [parentOpen]);

  return (
    <Combobox
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
            aria-label="Parent category"
            className="h-auto min-h-8 w-full min-w-0 justify-between gap-2 overflow-hidden py-1.5 font-normal"
          />
        }
      >
        <ComboboxValue>
          {selected?.category ? (
            <CategoryBadge color={getCategoryDisplayColor(selected.category)}>
              {selected.category.name}
            </CategoryBadge>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </ComboboxValue>
      </ComboboxTrigger>

      <ComboboxContent aria-label="Select parent category">
        <ComboboxInput
          aria-label="Search categories"
          placeholder="Search categories"
          autoFocus
          showTrigger={false}
        />
        <ComboboxEmpty>No categories match.</ComboboxEmpty>
        <ComboboxList>
          {(option) => (
            <ComboboxItem key={option.value || "none"} value={option} className="py-2.5 pl-2">
              {option.category ? (
                <CategoryBadge color={getCategoryDisplayColor(option.category)}>
                  {option.category.name}
                </CategoryBadge>
              ) : (
                <span className="px-1.5 text-muted-foreground">None</span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export { CategoryParentCombobox };
