import { Add01Icon, Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { getCategoryDisplayColor } from "../lib/category";
import type { CategoryFormMode } from "../types/category-types";
import type { TransactionCategory } from "../types/model";
import { ColorDot } from "./color-dot";

interface CategoryListProps {
  categories: Array<TransactionCategory>;
  onAddChild: (parentId: string) => void;
  onEdit: (mode: CategoryFormMode) => void;
  onDelete: (category: TransactionCategory) => void;
}

const revealOnRow =
  "opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 motion-reduce:transition-none";

function CategoryList({ categories, onAddChild, onEdit, onDelete }: CategoryListProps) {
  const rootCategories = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Array<TransactionCategory>>();
    for (const category of categories) {
      if (category.parentId) {
        const siblings = map.get(category.parentId) ?? [];
        siblings.push(category);
        map.set(category.parentId, siblings);
      }
    }
    return map;
  }, [categories]);

  return (
    <div className="border">
      <div className="border-b bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium">Category</span>
      </div>
      <ul className="divide-y">
        {rootCategories.map((category) => {
          const children = childrenByParent.get(category.id) ?? [];

          return (
            <li key={category.id}>
              <div className="group/row flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                <ColorDot color={getCategoryDisplayColor(category)} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{category.name}</span>
                  {category.description ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {category.description}
                    </span>
                  ) : null}
                </div>
                <div className={`flex shrink-0 items-center gap-1 ${revealOnRow}`}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Add subcategory to ${category.name}`}
                    title="Add subcategory"
                    onClick={() => onAddChild(category.id)}
                  >
                    <HugeiconsIcon icon={Add01Icon} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${category.name}`}
                    title="Edit"
                    onClick={() => onEdit({ type: "edit", category })}
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${category.name}`}
                    title="Delete"
                    onClick={() => onDelete(category)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} />
                  </Button>
                </div>
              </div>

              {children.length > 0 ? (
                <ul className="ml-5 border-l">
                  {children.map((child) => (
                    <li
                      key={child.id}
                      className="group/row flex items-center gap-3 py-2 pr-3 pl-4 hover:bg-muted/50"
                    >
                      <ColorDot color={getCategoryDisplayColor(child)} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm">{child.name}</span>
                        {child.description ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {child.description}
                          </span>
                        ) : null}
                      </div>
                      <div className={`flex shrink-0 items-center gap-1 ${revealOnRow}`}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${child.name}`}
                          title="Edit"
                          onClick={() => onEdit({ type: "edit", category: child })}
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${child.name}`}
                          title="Delete"
                          onClick={() => onDelete(child)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CategoryListSkeleton() {
  return (
    <div className="border">
      <div className="border-b bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Category</span>
      </div>
      <ul className="divide-y">
        {[0, 1, 2, 3].map((row) => (
          <li key={row} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="size-3" />
            <Skeleton className="h-3.5 w-40" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export { CategoryList, CategoryListSkeleton };
