import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDataTransferHorizontalIcon, Cancel01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
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
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="end">
          <div className="flex flex-col gap-0.5">
            {TYPE_FILTER_OPTIONS.map((option) => (
              <Button
                key={option.label}
                type="button"
                variant={selection === option.value ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => selectOption(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

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
