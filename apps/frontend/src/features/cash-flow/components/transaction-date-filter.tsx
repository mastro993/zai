import { useState } from "react";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  advanceRangeSelection,
  DATE_RANGE_PRESETS,
  DEFAULT_DATE_SELECTION,
  formatSelectionLabel,
  isActiveSelection,
  type DateRangePresetId,
  type DateRangeSelection,
  type RangeDraft,
} from "../lib/date-range";

type TransactionDateFilterProps = {
  selection: DateRangeSelection;
  onSelectionChange: (selection: DateRangeSelection) => void;
};

const toDraftRange = (selection: DateRangeSelection): RangeDraft | undefined =>
  selection.type === "custom"
    ? { from: parseISO(selection.from), to: parseISO(selection.to) }
    : undefined;

export function TransactionDateFilter({
  selection,
  onSelectionChange,
}: TransactionDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<RangeDraft | undefined>(undefined);

  const active = isActiveSelection(selection);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraftRange(toDraftRange(selection));
    }

    setOpen(next);
  };

  const selectPreset = (id: DateRangePresetId) => {
    onSelectionChange({ type: "preset", id });
    setOpen(false);
  };

  // react-day-picker completes a single-day range on the first click, so we run
  // the two-click machine ourselves off the clicked day (`triggerDate`).
  const handleDaySelect = (_range: DateRange | undefined, day: Date) => {
    const { draft, committed } = advanceRangeSelection(draftRange, day);
    setDraftRange(draft);

    if (committed) {
      onSelectionChange({
        type: "custom",
        from: format(committed.from, "yyyy-MM-dd"),
        to: format(committed.to, "yyyy-MM-dd"),
      });
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={cn("justify-start gap-2 font-normal", !active && "text-muted-foreground")}
            />
          }
        >
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
          {formatSelectionLabel(selection)}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex">
            <div className="flex flex-col gap-0.5 border-r p-2">
              {DATE_RANGE_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant={
                    selection.type === "preset" && selection.id === preset.id
                      ? "secondary"
                      : "ghost"
                  }
                  size="sm"
                  className="justify-start"
                  onClick={() => selectPreset(preset.id)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Calendar
              mode="range"
              numberOfMonths={2}
              autoFocus
              defaultMonth={draftRange?.from}
              selected={
                draftRange?.from
                  ? { from: draftRange.from, to: draftRange.to }
                  : undefined
              }
              onSelect={handleDaySelect}
            />
          </div>
        </PopoverContent>
      </Popover>

      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear date filter"
          onClick={() => onSelectionChange(DEFAULT_DATE_SELECTION)}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      ) : null}
    </div>
  );
}
