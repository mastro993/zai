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
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

import {
  getCategoryDisplayColor,
  getCategoryDisplayName,
} from "@/features/categories/lib/category";
import {
  getCategorySelectionItems,
  groupCategories,
} from "@/features/categories/lib/category-selection";
import type { TransactionCategory } from "@/features/categories/types/model";
import { CategoryBadge } from "@/features/categories/components/category-badge";

interface BudgetCategoryComboboxProps {
  id: string;
  categories: Array<TransactionCategory>;
  value: Array<string>;
  parentOpen: boolean;
  invalid?: boolean;
  onChange: (value: Array<string>) => void;
  onBlur?: () => void;
}

interface BudgetCategoryOption {
  value: string;
  label: string;
  category: TransactionCategory;
}

const getCategoryOptions = (
  categories: Array<TransactionCategory>,
  query: string,
): Array<BudgetCategoryOption> => {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  return groupCategories(categories, query).flatMap(({ root, visibleChildren }) => {
    const options = root ? [root, ...visibleChildren] : visibleChildren;
    return options.map((category) => ({
      value: category.id,
      label: getCategoryDisplayName(category, categoriesById),
      category,
    }));
  });
};

const getDescendantIds = (rootId: string, categories: Array<TransactionCategory>) =>
  categories.filter((category) => category.parentId === rootId).map((category) => category.id);

const getCanonicalCategoryIds = (
  selectedIds: Iterable<string>,
  categories: Array<TransactionCategory>,
) => {
  const selectedIdSet = new Set(selectedIds);
  const canonicalIds = new Set<string>();
  const knownIds = new Set(categories.map((category) => category.id));

  for (const group of groupCategories(categories, "")) {
    if (!group.root) {
      for (const category of group.children) {
        if (selectedIdSet.has(category.id)) canonicalIds.add(category.id);
      }
      continue;
    }

    const allChildrenSelected =
      group.children.length > 0 &&
      group.children.every((category) => selectedIdSet.has(category.id));

    if (selectedIdSet.has(group.root.id) || allChildrenSelected) {
      canonicalIds.add(group.root.id);
      continue;
    }

    for (const category of group.children) {
      if (selectedIdSet.has(category.id)) canonicalIds.add(category.id);
    }
  }

  for (const selectedId of selectedIdSet) {
    if (!knownIds.has(selectedId)) canonicalIds.add(selectedId);
  }

  const orderedIds = [...categories.map((category) => category.id), ...selectedIds];
  const seen = new Set<string>();
  return orderedIds.filter((id) => canonicalIds.has(id) && !seen.has(id) && seen.add(id));
};

const getEffectiveCategoryIds = (
  selectedIds: Array<string>,
  categories: Array<TransactionCategory>,
) => {
  const effectiveIds = new Set(selectedIds);
  for (const category of categories) {
    if (!category.parentId && effectiveIds.has(category.id)) {
      for (const descendantId of getDescendantIds(category.id, categories)) {
        effectiveIds.add(descendantId);
      }
    }
  }

  return effectiveIds;
};

function BudgetCategoryCombobox({
  id,
  categories,
  value,
  parentOpen,
  invalid,
  onChange,
  onBlur,
}: BudgetCategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = useMemo(() => getCategoryOptions(categories, ""), [categories]);
  const filteredItems = useMemo(
    () => getCategoryOptions(categories, query.trim().toLocaleLowerCase()),
    [categories, query],
  );
  const effectiveSelectedIds = useMemo(
    () => getEffectiveCategoryIds(value, categories),
    [categories, value],
  );
  const selectedItems = useMemo(
    () => items.filter((item) => effectiveSelectedIds.has(item.value)),
    [effectiveSelectedIds, items],
  );
  const selectedScopes = useMemo(
    () => getCategorySelectionItems(categories, value),
    [categories, value],
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories],
  );

  useEffect(() => {
    if (!parentOpen) {
      setOpen(false);
      setQuery("");
    }
  }, [parentOpen]);

  const handleValueChange = (nextItems: Array<BudgetCategoryOption>) => {
    const previousEffectiveIds = effectiveSelectedIds;
    const nextIds = new Set(nextItems.map((item) => item.value));
    const removedId = [...previousEffectiveIds].find((selectedId) => !nextIds.has(selectedId));
    const removedCategory = removedId ? categoriesById.get(removedId) : undefined;

    if (removedCategory) {
      if (!removedCategory.parentId) {
        nextIds.delete(removedCategory.id);
        for (const descendantId of getDescendantIds(removedCategory.id, categories)) {
          nextIds.delete(descendantId);
        }
      } else if (value.includes(removedCategory.parentId)) {
        nextIds.delete(removedCategory.parentId);
      }
    }

    onChange(getCanonicalCategoryIds(nextIds, categories));
  };

  return (
    <Combobox<BudgetCategoryOption, true>
      items={items}
      filteredItems={filteredItems}
      multiple
      value={selectedItems}
      open={open}
      inputValue={query}
      filter={null}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(item, selected) => item.value === selected.value}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
          onBlur?.();
        }
      }}
      onInputValueChange={setQuery}
      onValueChange={handleValueChange}
    >
      <ComboboxTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-label={
              selectedScopes.length === 0
                ? "Choose categories, all categories"
                : `Choose categories, ${selectedScopes.length} selected`
            }
            aria-invalid={invalid || undefined}
            className="h-auto min-h-8 w-full min-w-0 justify-between gap-2 overflow-hidden py-1.5 font-normal"
          />
        }
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selectedScopes.length === 0 ? (
            <span className="text-muted-foreground">All categories</span>
          ) : (
            selectedScopes.map(({ category, label }) => (
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
      </ComboboxTrigger>

      <ComboboxContent aria-label="Select categories">
        <ComboboxInput
          aria-label="Search categories"
          placeholder="Search categories"
          autoFocus
          showTrigger={false}
        />
        <ComboboxEmpty>
          {categories.length === 0
            ? "No categories yet. This budget will include all transactions."
            : query.trim().length > 0
              ? `No categories match “${query.trim()}”.`
              : "No categories found."}
        </ComboboxEmpty>
        <ComboboxList>
          {(option) => {
            const category = categoriesById.get(option.value);
            const rootId = category?.parentId ?? option.value;
            const root = categoriesById.get(rootId);
            const children = categories.filter((item) => item.parentId === rootId);
            const rootSelected = value.includes(rootId);
            const selectedChildCount = children.filter((item) =>
              effectiveSelectedIds.has(item.id),
            ).length;
            const partiallySelected =
              !option.category.parentId &&
              !rootSelected &&
              selectedChildCount > 0 &&
              selectedChildCount < children.length;

            return (
              <ComboboxItem
                key={option.value}
                value={option}
                aria-label={
                  partiallySelected ? `${option.label}, partially selected` : option.label
                }
                className={cn("py-2.5 pl-2", partiallySelected && "[&>span[data-selected]]:hidden")}
              >
                <CategoryBadge color={getCategoryDisplayColor(option.category)}>
                  {option.label}
                </CategoryBadge>
                {root && root.id === option.value && partiallySelected ? (
                  <span
                    className="pointer-events-none absolute right-2 flex size-4 items-center justify-center"
                    aria-hidden="true"
                  >
                    <span className="h-0.5 w-2 rounded-full bg-primary" />
                  </span>
                ) : null}
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export { BudgetCategoryCombobox };
export type { BudgetCategoryComboboxProps };
