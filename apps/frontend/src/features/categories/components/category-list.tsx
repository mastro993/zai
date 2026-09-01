import {
  Add01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, domAnimation, LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useMemo, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { getCategoryDisplayColor, getCategoryDisplayIcon } from "../lib/category";
import { getCategoryBadgeColors } from "../lib/category-color";
import { getCategoryIconEntry } from "../lib/category-icon";
import type { CategoryFormMode } from "../types/category-types";
import type { CategoryRole, TransactionCategory } from "../types/model";

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

function CategoryColorSquare({
  category,
  compact = false,
}: {
  category: TransactionCategory;
  compact?: boolean;
}) {
  const color = getCategoryDisplayColor(category);
  const { background, foreground } = getCategoryBadgeColors(color);
  const icon = getCategoryIconEntry(getCategoryDisplayIcon(category));

  return (
    <span className="flex size-9 shrink-0 items-center justify-center" aria-hidden="true">
      <span
        className={cn("flex items-center justify-center rounded-md", compact ? "size-7" : "size-9")}
        style={{ backgroundColor: background, color: foreground }}
      >
        <HugeiconsIcon
          icon={icon.icon}
          className={compact ? "size-3.5" : "size-4"}
          strokeWidth={2}
        />
      </span>
    </span>
  );
}

function CategoryRowContent({
  category,
  childCount,
  showChildCount = true,
  compact = false,
}: {
  category: TransactionCategory;
  childCount?: number;
  showChildCount?: boolean;
  compact?: boolean;
}) {
  const description = category.description?.trim() ?? "";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <CategoryColorSquare category={category} compact={compact} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{category.name}</span>
          {childCount !== undefined && childCount > 0 ? (
            <CategoryChildCount count={childCount} isVisible={showChildCount} />
          ) : null}
        </div>
        {description ? (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function CategoryChildCount({ count, isVisible }: { count: number; isVisible: boolean }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false} mode="sync">
      {isVisible ? (
        <m.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15, ease: "easeOut" }}
          className="shrink-0 text-xs tabular-nums text-muted-foreground"
        >
          +{count}
        </m.span>
      ) : null}
    </AnimatePresence>
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
      <CategoryRowContent category={category} childCount={childCount} showChildCount={!isOpen} />
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
    <div className="group/row flex items-center gap-2 px-3 py-2 hover:bg-muted/50">
      <CategoryRowContent category={category} compact />
      <CategoryRowActions category={category} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function CategoryChildren({
  category,
  childCategories,
  isOpen,
  onEdit,
  onDelete,
}: {
  category: TransactionCategory;
  childCategories: Array<TransactionCategory>;
  isOpen: boolean;
  onEdit: (mode: CategoryFormMode) => void;
  onDelete: (category: TransactionCategory) => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false} mode="sync">
      {isOpen ? (
        <m.ul
          key={category.id}
          aria-label={`Subcategories of ${category.name}`}
          className="divide-y overflow-hidden border-t"
          initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  height: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.15, ease: "easeOut" },
                }
          }
        >
          {childCategories.map((child) => (
            <li key={child.id}>
              <CategoryChildRow category={child} onEdit={onEdit} onDelete={onDelete} />
            </li>
          ))}
        </m.ul>
      ) : null}
    </AnimatePresence>
  );
}

function CategoryListSection({
  role,
  categories,
  childrenByParent,
  expandedIds,
  onSetParentOpen,
  onAddChild,
  onEdit,
  onDelete,
}: {
  role: CategoryRole;
  categories: Array<TransactionCategory>;
  childrenByParent: ReadonlyMap<string, Array<TransactionCategory>>;
  expandedIds: ReadonlySet<string>;
  onSetParentOpen: (parentId: string, open: boolean) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (mode: CategoryFormMode) => void;
  onDelete: (category: TransactionCategory) => void;
}) {
  const rootCategories = categories.filter(
    (category) => !category.parentId && category.role === role,
  );

  if (rootCategories.length === 0) {
    return null;
  }

  const label = role === "income" ? "Income" : "Spending";
  const headingId = `category-list-${role}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="pl-3 text-sm font-medium">
        {label}
      </h2>
      <div className="overflow-hidden rounded-lg border">
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
                <CategoryParentRow
                  category={category}
                  childCount={children.length}
                  isOpen={isOpen}
                  onToggle={() => onSetParentOpen(category.id, !isOpen)}
                  onAddChild={onAddChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
                <CategoryChildren
                  category={category}
                  childCategories={children}
                  isOpen={isOpen}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function CategoryList({ categories, onAddChild, onEdit, onDelete }: CategoryListProps) {
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

  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());

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
    <LazyMotion features={domAnimation}>
      <div className="flex flex-col gap-6">
        <CategoryListSection
          role="spending"
          categories={categories}
          childrenByParent={childrenByParent}
          expandedIds={expandedIds}
          onSetParentOpen={setParentOpen}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
        <CategoryListSection
          role="income"
          categories={categories}
          childrenByParent={childrenByParent}
          expandedIds={expandedIds}
          onSetParentOpen={setParentOpen}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </LazyMotion>
  );
}

function CategoryListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <ul className="divide-y">
        {[0, 1, 2, 3].map((row) => (
          <li key={row} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="size-9 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { CategoryList, CategoryListSkeleton };
