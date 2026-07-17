import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { getCategoryDisplayColor } from "../lib/category";
import type { TransactionCategory } from "../types/model";
import { CategoryBadge } from "./category-badge";

function CategoryCheckboxRow({
  category,
  checked,
  nested = false,
  inputIdPrefix,
  onCheckedChange,
}: {
  category: TransactionCategory;
  checked: boolean;
  nested?: boolean;
  inputIdPrefix: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const inputId = `${inputIdPrefix}-${category.id}`;

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

function CategoryOptionRow({
  category,
  selected,
  nested = false,
  embedded = false,
  optionId,
  onSelect,
}: {
  category: TransactionCategory;
  selected: boolean;
  nested?: boolean;
  embedded?: boolean;
  optionId: string;
  onSelect: () => void;
}) {
  return (
    <button
      id={optionId}
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        "flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left focus-visible:outline-none",
        nested ? "pl-11" : null,
        embedded
          ? null
          : selected
            ? "bg-primary/5 hover:bg-primary/5 focus-visible:bg-primary/5"
            : "hover:bg-muted/40 focus-visible:bg-muted/40",
      )}
      onClick={onSelect}
    >
      <CategoryBadge color={getCategoryDisplayColor(category)}>{category.name}</CategoryBadge>
      <span
        className={cn(
          "ml-auto flex size-4 shrink-0 items-center justify-center",
          selected ? "text-primary" : "text-transparent",
        )}
        aria-hidden="true"
      >
        <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={2.5} />
      </span>
    </button>
  );
}

function ExpandControl({
  root,
  childrenCount,
  deferredQuery,
  isExpanded,
  showChildren,
  onToggle,
}: {
  root: TransactionCategory;
  childrenCount: number;
  deferredQuery: string;
  isExpanded: boolean;
  showChildren: boolean;
  onToggle: () => void;
}) {
  if (childrenCount === 0) {
    return <span className="ml-1 size-6" aria-hidden="true" />;
  }

  if (deferredQuery.length > 0) {
    return (
      <span className="ml-1 flex size-6 items-center justify-center" aria-hidden="true">
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="ml-1"
      aria-label={isExpanded ? `Collapse ${root.name}` : `Expand ${root.name}`}
      aria-expanded={showChildren}
      onClick={onToggle}
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
  );
}

export { CategoryCheckboxRow, CategoryOptionRow, ExpandControl };
