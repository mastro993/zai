import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Tag01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { getCategoryDisplayName } from "../lib/category";
import {
  DEFAULT_CATEGORY_FILTER_SELECTION,
  buildChildrenByParent,
  formatCategoryFilterLabel,
  getCategoryDotColor,
  getRootCategories,
  isActiveCategoryFilter,
  isChildIncludedByRollup,
  isChildSelected,
  isRootSelected,
  matchesCategorySearch,
  toggleChildSelection,
  toggleRootSelection,
  toggleUncategorized,
  type CategoryFilterSelection,
} from "../lib/transaction-category-filter";
import type { TransactionCategory } from "../types/model";

type TransactionCategoryFilterProps = {
  categories: Array<TransactionCategory>;
  selection: CategoryFilterSelection;
  isLoading?: boolean;
  onSelectionChange: (selection: CategoryFilterSelection) => void;
};

function CategoryDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

export function TransactionCategoryFilter({
  categories,
  selection,
  isLoading = false,
  onSelectionChange,
}: TransactionCategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const active = isActiveCategoryFilter(selection);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories],
  );
  const childrenByParent = useMemo(() => buildChildrenByParent(categories), [categories]);
  const rootCategories = useMemo(() => getRootCategories(categories), [categories]);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visibleRoots = rootCategories.filter((root) => {
    if (normalizedSearch.length === 0) {
      return true;
    }

    const children = childrenByParent.get(root.id) ?? [];
    const rootMatches = matchesCategorySearch(root, categoryById, searchQuery);
    const childMatches = children.some((child) =>
      matchesCategorySearch(child, categoryById, searchQuery),
    );

    return rootMatches || childMatches;
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearchQuery("");
    }

    setOpen(next);
  };

  return (
    <div className="flex items-center">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              aria-label="Filter by category"
              className={cn("justify-start gap-2 font-normal", !active && "text-muted-foreground")}
            />
          }
        >
          <HugeiconsIcon icon={Tag01Icon} strokeWidth={2} />
          {formatCategoryFilterLabel(selection, categories)}
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="sticky top-0 z-10 border-b bg-popover p-2">
            <Input
              type="search"
              placeholder="Search categories…"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {categories.length === 0 ? (
              <div className="flex flex-col items-start gap-2 px-1 py-2 text-sm text-muted-foreground">
                <p>No categories yet. Create categories to organize transactions.</p>
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm"
                  render={<Link to="/cash-flow/categories" />}
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  Manage categories
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {normalizedSearch.length === 0 || "uncategorized".includes(normalizedSearch) ? (
                  <Button
                    type="button"
                    variant={selection.includeUncategorized ? "secondary" : "ghost"}
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => {
                      onSelectionChange(toggleUncategorized(selection));
                    }}
                  >
                    Uncategorized
                  </Button>
                ) : null}

                {visibleRoots.length > 0 ? <Separator className="my-1" /> : null}

                {visibleRoots.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    No categories match your search.
                  </p>
                ) : (
                  visibleRoots.map((root) => {
                    const children = (childrenByParent.get(root.id) ?? []).filter((child) =>
                      matchesCategorySearch(child, categoryById, searchQuery),
                    );
                    const showRoot =
                      normalizedSearch.length === 0 ||
                      matchesCategorySearch(root, categoryById, searchQuery);

                    return (
                      <div key={root.id} className="flex flex-col gap-0.5">
                        {showRoot ? (
                          <Button
                            type="button"
                            variant={isRootSelected(selection, root.id) ? "secondary" : "ghost"}
                            size="sm"
                            className="justify-start gap-2"
                            onClick={() => {
                              onSelectionChange(
                                toggleRootSelection(
                                  selection,
                                  root.id,
                                  childrenByParent.get(root.id) ?? [],
                                ),
                              );
                            }}
                          >
                            <CategoryDot color={getCategoryDotColor(root)} />
                            {root.name}
                          </Button>
                        ) : null}

                        {children.map((child) => (
                          <Button
                            key={child.id}
                            type="button"
                            variant={isChildSelected(selection, child) ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                              "justify-start gap-2 pl-6",
                              isChildIncludedByRollup(selection, child) && "text-muted-foreground",
                            )}
                            onClick={() => {
                              onSelectionChange(
                                toggleChildSelection(selection, child, childrenByParent),
                              );
                            }}
                          >
                            <CategoryDot color={getCategoryDotColor(child)} />
                            {getCategoryDisplayName(child, categoryById)}
                          </Button>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear category filter"
          onClick={() => onSelectionChange(DEFAULT_CATEGORY_FILTER_SELECTION)}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      ) : null}
    </div>
  );
}
