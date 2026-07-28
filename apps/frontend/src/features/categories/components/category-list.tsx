import {
  Add01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { getCategoryDisplayColor, getCategoryRoleLabel } from "../lib/category";
import type { CategoryFormMode } from "../types/category-types";
import type { TransactionCategory } from "../types/model";
import { CategoryBadge } from "./category-badge";

interface CategoryListProps {
  categories: Array<TransactionCategory>;
  onAddChild: (parentId: string) => void;
  onEdit: (mode: CategoryFormMode) => void;
  onDelete: (category: TransactionCategory) => void;
}

const revealOnRow =
  "opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 motion-reduce:transition-none";

function CategoryRowActions({
  category,
  onAddChild,
  onEdit,
  onDelete,
}: {
  category: TransactionCategory;
  onAddChild?: (parentId: string) => void;
  onEdit: (mode: CategoryFormMode) => void;
  onDelete: (category: TransactionCategory) => void;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1", revealOnRow)}>
      {onAddChild ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Add subcategory to ${category.name}`}
          title="Add subcategory"
          onClick={() => onAddChild(category.id)}
        >
          <HugeiconsIcon icon={Add01Icon} />
        </Button>
      ) : null}
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
  );
}

function CategoryRowContent({
  category,
  childCount,
}: {
  category: TransactionCategory;
  childCount?: number;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <CategoryBadge color={getCategoryDisplayColor(category)}>{category.name}</CategoryBadge>
        <span className="shrink-0 border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {getCategoryRoleLabel(category.role)}
        </span>
        {childCount !== undefined && childCount > 0 ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">+{childCount}</span>
        ) : null}
      </div>
      {category.description ? (
        <span className="truncate text-xs text-muted-foreground">{category.description}</span>
      ) : null}
    </div>
  );
}

function CategoryChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <HugeiconsIcon
      icon={ArrowDown01Icon}
      className={cn(
        "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none",
        isOpen ? "rotate-0" : "-rotate-90",
      )}
      strokeWidth={2}
      aria-hidden="true"
    />
  );
}

function CategoryParentRow({
  category,
  childCount,
  isOpen,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
}: {
  category: TransactionCategory;
  childCount: number;
  isOpen: boolean;
  onToggle: () => void;
  onAddChild: (parentId: string) => void;
  onEdit: (mode: CategoryFormMode) => void;
  onDelete: (category: TransactionCategory) => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      aria-label={isOpen ? `Collapse ${category.name}` : `Expand ${category.name}`}
      className="group/row flex cursor-pointer items-center gap-2 px-3 py-2.5 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <CategoryRowContent category={category} childCount={childCount} />
      <div
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <CategoryRowActions
          category={category}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
      <CategoryChevronIcon isOpen={isOpen} />
    </div>
  );
}

function CategoryChildRow({
  category,
  onEdit,
  onDelete,
}: {
  category: TransactionCategory;
  onEdit: (mode: CategoryFormMode) => void;
  onDelete: (category: TransactionCategory) => void;
}) {
  return (
    <div className="group/row flex items-center gap-2 py-2 pr-3 pl-10 hover:bg-muted/50">
      <CategoryRowContent category={category} />
      <CategoryRowActions category={category} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

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

  const expandableParentIds = useMemo(
    () =>
      rootCategories
        .filter((category) => (childrenByParent.get(category.id)?.length ?? 0) > 0)
        .map((category) => category.id),
    [childrenByParent, rootCategories],
  );

  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());

  const allExpanded =
    expandableParentIds.length > 0 && expandableParentIds.every((id) => expandedIds.has(id));
  const allCollapsed = expandableParentIds.every((id) => !expandedIds.has(id));

  const expandAll = () => {
    setExpandedIds(new Set(expandableParentIds));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const setParentOpen = (parentId: string, open: boolean) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (open) {
        next.add(parentId);
      } else {
        next.delete(parentId);
      }
      return next;
    });
  };

  return (
    <div className="border">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium">Categories</span>
        {expandableParentIds.length > 0 ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="xs" disabled={allExpanded} onClick={expandAll}>
              Expand all
            </Button>
            <Button variant="ghost" size="xs" disabled={allCollapsed} onClick={collapseAll}>
              Collapse all
            </Button>
          </div>
        ) : null}
      </div>
      <ul className="divide-y">
        {rootCategories.map((category) => {
          const children = childrenByParent.get(category.id) ?? [];
          const hasChildren = children.length > 0;

          if (!hasChildren) {
            return (
              <li key={category.id}>
                <div className="group/row flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50">
                  <CategoryRowContent category={category} />
                  <CategoryRowActions
                    category={category}
                    onAddChild={onAddChild}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </div>
              </li>
            );
          }

          const isOpen = expandedIds.has(category.id);

          return (
            <li key={category.id}>
              <Collapsible open={isOpen} onOpenChange={(open) => setParentOpen(category.id, open)}>
                <CategoryParentRow
                  category={category}
                  childCount={children.length}
                  isOpen={isOpen}
                  onToggle={() => setParentOpen(category.id, !isOpen)}
                  onAddChild={onAddChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
                <CollapsibleContent>
                  <ul className="divide-y border-t">
                    {children.map((child) => (
                      <li key={child.id}>
                        <CategoryChildRow category={child} onEdit={onEdit} onDelete={onDelete} />
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
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
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2">
        <Skeleton className="h-4 w-20" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
      <ul className="divide-y">
        {[0, 1, 2, 3].map((row) => (
          <li key={row} className="flex items-center gap-2 px-3 py-2.5">
            <Skeleton className="h-5 w-28" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export { CategoryList, CategoryListSkeleton };
