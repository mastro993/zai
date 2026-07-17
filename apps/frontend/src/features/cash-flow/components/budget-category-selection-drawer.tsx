import { ArrowDown01Icon, ArrowLeft01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

import { getCategoryDisplayColor } from "../lib/category";
import type { TransactionCategory } from "../types/model";
import { CategoryBadge } from "./category-badge";

interface CategoryGroup {
  root: TransactionCategory | null;
  children: Array<TransactionCategory>;
  visibleChildren: Array<TransactionCategory>;
}

interface BudgetCategorySelectionDrawerProps {
  open: boolean;
  categories: Array<TransactionCategory>;
  selectedIds: Array<string>;
  onSelectedIdsChange: (selectedIds: Array<string>) => void;
}

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

    return query.length === 0 || rootMatches || visibleChildren.length > 0
      ? [{ root, children, visibleChildren }]
      : [];
  });
  const orphanedChildren = categories.filter(
    (category) =>
      category.parentId &&
      !rootIds.has(category.parentId) &&
      (query.length === 0 || matchesQuery(category, query)),
  );

  return orphanedChildren.length > 0
    ? [...groups, { root: null, children: orphanedChildren, visibleChildren: orphanedChildren }]
    : groups;
}

function getRootState(
  root: TransactionCategory,
  children: Array<TransactionCategory>,
  selectedIdSet: ReadonlySet<string>,
) {
  const rootSelected = selectedIdSet.has(root.id);
  const selectedChildCount = children.filter(
    (category) => rootSelected || selectedIdSet.has(category.id),
  ).length;
  const allChildrenSelected = children.length > 0 && selectedChildCount === children.length;

  return {
    checked: rootSelected || allChildrenSelected,
    indeterminate: !rootSelected && selectedChildCount > 0 && !allChildrenSelected,
  };
}

function toggleRootSelection(
  selectedIds: Array<string>,
  root: TransactionCategory,
  children: Array<TransactionCategory>,
  checked: boolean,
) {
  const groupIds = new Set([root.id, ...children.map((category) => category.id)]);
  const nextIds = selectedIds.filter((selectedId) => !groupIds.has(selectedId));
  return checked ? [...nextIds, root.id] : nextIds;
}

function toggleChildSelection(
  selectedIds: Array<string>,
  root: TransactionCategory,
  children: Array<TransactionCategory>,
  categoryId: string,
  checked: boolean,
) {
  const nextIdSet = new Set(selectedIds);
  if (nextIdSet.delete(root.id)) {
    for (const category of children) nextIdSet.add(category.id);
  }

  if (checked) nextIdSet.add(categoryId);
  else nextIdSet.delete(categoryId);

  if (children.every((category) => nextIdSet.has(category.id))) {
    for (const category of children) nextIdSet.delete(category.id);
    nextIdSet.add(root.id);
  }

  return Array.from(nextIdSet);
}

function getCategorySelectionItems(
  categories: Array<TransactionCategory>,
  selectedIds: Array<string>,
) {
  const selectedIdSet = new Set(selectedIds);
  return groupCategories(categories, "").flatMap(({ root, children }) => {
    if (!root) return children.filter((category) => selectedIdSet.has(category.id));
    if (getRootState(root, children, selectedIdSet).checked) return [root];
    return children.filter((category) => selectedIdSet.has(category.id));
  });
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
      className={cn("min-w-0 gap-2 px-3 py-2.5", nested ? "pl-11" : null)}
    >
      <Checkbox id={inputId} checked={checked} onCheckedChange={onCheckedChange} />
      <FieldLabel htmlFor={inputId} className="min-w-0 flex-1 font-normal">
        <CategoryBadge color={getCategoryDisplayColor(category)}>{category.name}</CategoryBadge>
      </FieldLabel>
    </Field>
  );
}

function BudgetCategorySelectionDrawer({
  open,
  categories,
  selectedIds,
  onSelectedIdsChange,
}: BudgetCategorySelectionDrawerProps) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const groups = useMemo(
    () => groupCategories(categories, deferredQuery),
    [categories, deferredQuery],
  );
  const selectionCount = useMemo(
    () => getCategorySelectionItems(categories, selectedIds).length,
    [categories, selectedIds],
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const toggleExpanded = (categoryId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  return (
    <DrawerContent className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem] data-[swipe-axis=x]:w-[calc(100%-2rem)] sm:data-[swipe-axis=x]:w-96">
      <DrawerHeader className="flex-row items-start gap-2">
        <DrawerClose
          render={
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to budget" />
          }
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
        </DrawerClose>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DrawerTitle>Select categories</DrawerTitle>
          <DrawerDescription>Only selected categories count toward this budget.</DrawerDescription>
        </div>
      </DrawerHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <Field>
          <FieldLabel htmlFor="budget-category-search" className="sr-only">
            Search categories
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <HugeiconsIcon icon={Search01Icon} aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="budget-category-search"
              type="search"
              placeholder="Search categories"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        </Field>

        <div
          role="group"
          aria-label="Budget categories"
          className="min-h-0 flex-1 overflow-y-auto border"
        >
          {categories.length === 0 ? (
            <FieldDescription className="px-3 py-8 text-center">
              No categories yet. This budget will include all transactions.
            </FieldDescription>
          ) : groups.length === 0 ? (
            <FieldDescription className="px-3 py-8 text-center">
              No categories match “{query.trim()}”.
            </FieldDescription>
          ) : (
            groups.map(({ root, children, visibleChildren }) => {
              if (!root) {
                return visibleChildren.map((category) => (
                  <CategoryCheckboxRow
                    key={category.id}
                    category={category}
                    checked={selectedIdSet.has(category.id)}
                    onCheckedChange={(checked) => {
                      onSelectedIdsChange(
                        checked
                          ? [...selectedIds, category.id]
                          : selectedIds.filter((selectedId) => selectedId !== category.id),
                      );
                    }}
                  />
                ));
              }

              const rootState = getRootState(root, children, selectedIdSet);
              const isExpanded = expandedIds.has(root.id);
              const showChildren = deferredQuery.length > 0 || isExpanded;

              return (
                <div key={root.id} className="border-b last:border-b-0">
                  <div className="flex min-w-0 items-center">
                    {children.length > 0 && deferredQuery.length > 0 ? (
                      <span
                        className="ml-1 flex size-6 items-center justify-center"
                        aria-hidden="true"
                      >
                        <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
                      </span>
                    ) : children.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="ml-1"
                        aria-label={isExpanded ? `Collapse ${root.name}` : `Expand ${root.name}`}
                        aria-expanded={showChildren}
                        onClick={() => toggleExpanded(root.id)}
                      >
                        <HugeiconsIcon
                          icon={ArrowDown01Icon}
                          className={cn(
                            "transition-transform duration-200 ease-out motion-reduce:transition-none",
                            showChildren ? null : "-rotate-90",
                          )}
                          aria-hidden="true"
                        />
                      </Button>
                    ) : (
                      <span className="ml-1 size-6" aria-hidden="true" />
                    )}
                    <Field orientation="horizontal" className="min-w-0 flex-1 gap-2 px-2 py-2.5">
                      <Checkbox
                        id={`budget-category-${root.id}`}
                        checked={rootState.checked}
                        indeterminate={rootState.indeterminate}
                        onCheckedChange={(checked) =>
                          onSelectedIdsChange(
                            toggleRootSelection(selectedIds, root, children, checked),
                          )
                        }
                      />
                      <FieldLabel
                        htmlFor={`budget-category-${root.id}`}
                        className="min-w-0 flex-1 font-normal"
                      >
                        <CategoryBadge color={getCategoryDisplayColor(root)}>
                          {root.name}
                        </CategoryBadge>
                        {children.length > 0 ? (
                          <span
                            className="shrink-0 text-xs tabular-nums text-muted-foreground"
                            aria-hidden="true"
                          >
                            +{children.length}
                          </span>
                        ) : null}
                      </FieldLabel>
                    </Field>
                  </div>
                  {showChildren
                    ? visibleChildren.map((category) => (
                        <CategoryCheckboxRow
                          key={category.id}
                          category={category}
                          nested
                          checked={rootState.checked || selectedIdSet.has(category.id)}
                          onCheckedChange={(checked) =>
                            onSelectedIdsChange(
                              toggleChildSelection(
                                selectedIds,
                                root,
                                children,
                                category.id,
                                checked,
                              ),
                            )
                          }
                        />
                      ))
                    : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <DrawerFooter className="flex-row items-center justify-between border-t pt-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {selectionCount === 0
              ? "None selected"
              : `${selectionCount} ${selectionCount === 1 ? "category" : "categories"}`}
          </span>
          {selectionCount > 0 ? (
            <Button type="button" size="xs" variant="ghost" onClick={() => onSelectedIdsChange([])}>
              Clear
            </Button>
          ) : null}
        </div>
        <DrawerClose render={<Button type="button" />}>Done</DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  );
}

export { BudgetCategorySelectionDrawer, getCategorySelectionItems };
