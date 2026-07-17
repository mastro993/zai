import { ArrowLeft01Icon, ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type HugeIcon = typeof ArrowRight01Icon;

interface BudgetFormOption<T extends string> {
  value: T;
  label: string;
  description: string;
  icon: HugeIcon;
}

interface BudgetFormOptionFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: Array<BudgetFormOption<T>>;
  onChange: (value: T) => void;
  onBlur: () => void;
  formOpen: boolean;
  ariaLabel: string;
  drawerTitle: string;
  drawerDescription: string;
}

function BudgetFormOptionField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  onBlur,
  formOpen,
  ariaLabel,
  drawerTitle,
  drawerDescription,
}: BudgetFormOptionFieldProps<T>) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!formOpen) setIsDrawerOpen(false);
  }, [formOpen]);

  const handleOpenChange = (open: boolean) => {
    setIsDrawerOpen(open);
    if (!open) onBlur();
  };

  const selectOption = (next: T) => {
    onChange(next);
    setIsDrawerOpen(false);
    onBlur();
  };

  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Drawer open={isDrawerOpen} onOpenChange={handleOpenChange} swipeDirection="right">
        <DrawerTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className="h-8 w-full min-w-0 justify-between gap-2 overflow-hidden px-2.5 font-normal"
              aria-label={ariaLabel}
              aria-haspopup="dialog"
              aria-expanded={isDrawerOpen}
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected ? (
              <HugeiconsIcon
                icon={selected.icon}
                className="size-3.5 shrink-0 text-muted-foreground"
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : null}
            <span className="truncate">{selected?.label}</span>
          </span>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="shrink-0"
            data-icon="inline-end"
            aria-hidden="true"
          />
        </DrawerTrigger>
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
              <DrawerTitle>{drawerTitle}</DrawerTitle>
              <DrawerDescription>{drawerDescription}</DrawerDescription>
            </div>
          </DrawerHeader>

          <div className="p-4">
            <div
              id={listId}
              role="listbox"
              aria-label={drawerTitle}
              aria-activedescendant={`${id}-option-${value}`}
              className="border"
            >
              {options.map((option) => {
                const selectedOption = option.value === value;
                const optionId = `${id}-option-${option.value}`;
                return (
                  <button
                    key={option.value}
                    id={optionId}
                    type="button"
                    role="option"
                    aria-selected={selectedOption}
                    className={cn(
                      "flex w-full items-start gap-3 border-b px-3 py-3 text-left last:border-b-0",
                      "focus-visible:outline-none",
                      selectedOption
                        ? "bg-primary/5 hover:bg-primary/5 focus-visible:bg-primary/5"
                        : "hover:bg-muted/40 focus-visible:bg-muted/40",
                    )}
                    onClick={() => selectOption(option.value)}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center border",
                        selectedOption
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-muted-foreground",
                      )}
                      aria-hidden="true"
                    >
                      <HugeiconsIcon icon={option.icon} className="size-3.5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span
                        className={cn(
                          "block text-xs font-medium",
                          selectedOption ? "text-primary" : "text-foreground",
                        )}
                      >
                        {option.label}
                      </span>
                      <span className="block text-xs text-pretty text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center",
                        selectedOption ? "text-primary" : "text-transparent",
                      )}
                      aria-hidden="true"
                    >
                      <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={2.5} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </Field>
  );
}

export { BudgetFormOptionField };
export type { BudgetFormOption };
