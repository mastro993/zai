import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";

import type { CategoryRole } from "../types/model";
import { CATEGORY_ROLE_OPTIONS } from "./category-role-options";

interface CategoryRoleComboboxProps {
  id: string;
  value: CategoryRole | undefined;
  parentOpen: boolean;
  invalid?: boolean;
  onChange: (value: CategoryRole) => void;
  onBlur?: () => void;
}

function CategoryRoleCombobox({
  id,
  value,
  parentOpen,
  invalid,
  onChange,
  onBlur,
}: CategoryRoleComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = CATEGORY_ROLE_OPTIONS.find((option) => option.value === value);

  useEffect(() => {
    if (!parentOpen) setOpen(false);
  }, [parentOpen]);

  return (
    <Combobox
      items={CATEGORY_ROLE_OPTIONS}
      value={selected ?? null}
      open={open}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) onBlur?.();
      }}
      onValueChange={(nextOption) => {
        if (nextOption) onChange(nextOption.value);
      }}
    >
      <ComboboxTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-label="Category role"
            aria-invalid={invalid || undefined}
            className="h-8 w-full min-w-0 justify-between gap-2 overflow-hidden px-2.5 font-normal"
          />
        }
      >
        <ComboboxValue>
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <HugeiconsIcon icon={selected.icon} data-icon="inline-start" aria-hidden="true" />
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground">Select a role</span>
          )}
        </ComboboxValue>
      </ComboboxTrigger>

      <ComboboxContent>
        <ComboboxList>
          {(option) => (
            <ComboboxItem
              key={option.value}
              value={option}
              className="items-start gap-3 py-2.5 pl-2"
            >
              <span
                data-slot="category-role-icon"
                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"
                aria-hidden="true"
              >
                <HugeiconsIcon icon={option.icon} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                <span className="block text-xs leading-4 text-pretty text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export { CategoryRoleCombobox };
