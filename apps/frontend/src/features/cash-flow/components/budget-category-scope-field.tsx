import { useDeferredValue, useMemo, useState } from "react";
import { type Control, useController } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { BudgetFormInput, BudgetFormValues } from "../types/budget";
import type { TransactionCategory } from "../types/model";

interface CategoryGroup {
  root: TransactionCategory | null;
  children: Array<TransactionCategory>;
}

interface BudgetCategoryScopeFieldProps {
  categories: Array<TransactionCategory>;
  control: Control<BudgetFormInput, unknown, BudgetFormValues>;
}

const EMPTY_CATEGORY_IDS: Array<string> = [];

const matchesQuery = (category: TransactionCategory, query: string) =>
  category.name.toLocaleLowerCase().includes(query);

function groupCategories(
  categories: Array<TransactionCategory>,
  query: string,
): Array<CategoryGroup> {
  const roots = categories.filter((category) => !category.parentId);
  const rootIds = new Set(roots.map((category) => category.id));
  const childrenByParent = new Map<string, Array<TransactionCategory>>();

  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  const groups = roots.flatMap((root) => {
    const children = childrenByParent.get(root.id) ?? [];
    const rootMatches = matchesQuery(root, query);
    const visibleChildren = rootMatches
      ? children
      : children.filter((category) => matchesQuery(category, query));

    return rootMatches || visibleChildren.length > 0 || query.length === 0
      ? [{ root, children: visibleChildren }]
      : [];
  });
  const orphanedChildren = categories.filter(
    (category) =>
      category.parentId && !rootIds.has(category.parentId) && matchesQuery(category, query),
  );

  return orphanedChildren.length > 0
    ? [...groups, { root: null, children: orphanedChildren }]
    : groups;
}

function CategoryCheckboxRow({
  category,
  checked,
  nested = false,
  onCheckedChange,
}: {
  category: TransactionCategory;
  checked: boolean;
  nested?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const inputId = `budget-category-${category.id}`;

  return (
    <Field
      orientation="horizontal"
      className={nested ? "min-w-0 gap-2 px-2.5 py-1.5 pl-7" : "min-w-0 gap-2 px-2.5 py-2"}
    >
      <Checkbox
        id={inputId}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <FieldLabel htmlFor={inputId} className="min-w-0 flex-1 font-normal">
        <span className="truncate" title={category.name}>
          {category.name}
        </span>
      </FieldLabel>
    </Field>
  );
}

function BudgetCategoryScopeField({ categories, control }: BudgetCategoryScopeFieldProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const { field } = useController({ control, name: "categoryIds" });
  const selectedIds = field.value ?? EMPTY_CATEGORY_IDS;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const groups = useMemo(
    () => groupCategories(categories, deferredQuery),
    [categories, deferredQuery],
  );

  const toggleCategory = (categoryId: string, checked: boolean) => {
    field.onChange(
      checked
        ? [...selectedIds, categoryId]
        : selectedIds.filter((selectedId) => selectedId !== categoryId),
    );
  };

  return (
    <FieldSet>
      <div className="flex items-center justify-between gap-2">
        <FieldLegend className="mb-0">Category scope</FieldLegend>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" aria-live="polite">
            {selectedIds.length} selected
          </Badge>
          {selectedIds.length > 0 ? (
            <Button type="button" size="xs" variant="ghost" onClick={() => field.onChange([])}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <FieldDescription>
        Leave empty to include all transactions. Root categories include their subcategories.
      </FieldDescription>
      <FieldGroup className="gap-2">
        <Field>
          <FieldLabel htmlFor="budget-category-search" className="sr-only">
            Search categories
          </FieldLabel>
          <Input
            id="budget-category-search"
            type="search"
            placeholder="Search categories"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <div
          role="group"
          aria-label="Budget categories"
          className="max-h-56 overflow-y-auto border"
        >
          {categories.length === 0 ? (
            <FieldDescription className="px-3 py-6 text-center">
              No categories yet. This budget will include all transactions.
            </FieldDescription>
          ) : groups.length === 0 ? (
            <FieldDescription className="px-3 py-6 text-center">
              No categories match “{query.trim()}”.
            </FieldDescription>
          ) : (
            groups.map(({ root, children }) => (
              <div key={root?.id ?? "other"} className="border-b last:border-b-0">
                {root ? (
                  <CategoryCheckboxRow
                    category={root}
                    checked={selectedIdSet.has(root.id)}
                    onCheckedChange={(checked) => toggleCategory(root.id, checked)}
                  />
                ) : null}
                {children.map((category) => (
                  <CategoryCheckboxRow
                    key={category.id}
                    category={category}
                    nested={Boolean(root)}
                    checked={selectedIdSet.has(category.id)}
                    onCheckedChange={(checked) => toggleCategory(category.id, checked)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </FieldGroup>
    </FieldSet>
  );
}

export { BudgetCategoryScopeField };
