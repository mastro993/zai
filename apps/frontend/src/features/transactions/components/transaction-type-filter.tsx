import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import {
  DEFAULT_TYPE_FILTER_SELECTION,
  TYPE_FILTER_OPTIONS,
  formatTypeFilterLabel,
  isActiveTypeFilter,
  type TypeFilterSelection,
} from "../lib/transaction-type-filter";

type TransactionTypeFilterProps = {
  selection: TypeFilterSelection;
  onSelectionChange: (selection: TypeFilterSelection) => void;
};

const TYPE_FILTER_ICONS = {
  all: ArrowDataTransferHorizontalIcon,
  income: ArrowUp01Icon,
  expense: ArrowDown01Icon,
} as const;

type TypeFilterMenuValue = "all" | Exclude<TypeFilterSelection, null>;

const getMenuValue = (selection: TypeFilterSelection): TypeFilterMenuValue => selection ?? "all";

export function TransactionTypeFilter({
  selection,
  onSelectionChange,
}: TransactionTypeFilterProps) {
  const [open, setOpen] = useState(false);
  const active = isActiveTypeFilter(selection);

  const selectOption = (value: TypeFilterSelection) => {
    onSelectionChange(value);
    setOpen(false);
  };

  return (
    <div className="flex items-center">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label="Filter by type"
              className={cn("justify-start gap-2 font-normal", !active && "text-muted-foreground")}
            />
          }
        >
          <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} strokeWidth={2} />
          {formatTypeFilterLabel(selection)}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-36" align="end">
          <DropdownMenuRadioGroup
            value={getMenuValue(selection)}
            onValueChange={(value) => {
              const option = TYPE_FILTER_OPTIONS.find(
                (candidate) => getMenuValue(candidate.value) === value,
              );

              if (option) {
                selectOption(option.value);
              }
            }}
          >
            {TYPE_FILTER_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.label} value={getMenuValue(option.value)}>
                <HugeiconsIcon
                  icon={TYPE_FILTER_ICONS[getMenuValue(option.value)]}
                  strokeWidth={2}
                />
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear type filter"
          onClick={() => onSelectionChange(DEFAULT_TYPE_FILTER_SELECTION)}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      ) : null}
    </div>
  );
}
