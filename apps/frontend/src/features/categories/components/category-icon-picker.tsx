import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  CATEGORY_ICON_CATALOG,
  CATEGORY_ICON_GROUPS,
  getCategoryIconEntry,
  type CategoryIcon,
} from "../lib/category-icon";

function CategoryIconPicker({
  value,
  effectiveIcon,
  isChild,
  onChange,
}: {
  value: CategoryIcon | null;
  effectiveIcon: CategoryIcon;
  isChild: boolean;
  onChange: (icon: CategoryIcon | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = getCategoryIconEntry(effectiveIcon);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={`Category icon, ${selected.label}`}
            className="h-8 w-full justify-start gap-2 px-2.5 font-normal"
          />
        }
      >
        <HugeiconsIcon icon={selected.icon} className="size-4" strokeWidth={2} />
        {selected.label}
      </PopoverTrigger>
      <PopoverContent
        className="w-72 overflow-hidden p-0"
        align="start"
        aria-label="Category icons"
      >
        <ScrollArea className="h-80">
          <div className="flex flex-col gap-2.5 p-2.5">
            {isChild ? (
              <Button
                type="button"
                variant="ghost"
                aria-pressed={value === null}
                className={cn("h-8 w-full justify-start", value === null && "bg-accent")}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Inherit from parent
              </Button>
            ) : null}
            <TooltipProvider>
              {CATEGORY_ICON_GROUPS.map((group) => (
                <div key={group} className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{group}</p>
                  <div className="grid grid-cols-8 gap-1">
                    {CATEGORY_ICON_CATALOG.filter((entry) => entry.group === group).map((entry) => {
                      const isSelected = value === entry.key;
                      return (
                        <Tooltip key={entry.key}>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                aria-label={entry.label}
                                aria-pressed={isSelected}
                                className={cn(
                                  "relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  isSelected && "ring-2 ring-ring",
                                )}
                                onClick={() => {
                                  onChange(entry.key);
                                  setOpen(false);
                                }}
                              />
                            }
                          >
                            <HugeiconsIcon icon={entry.icon} className="size-4" strokeWidth={2} />
                            {isSelected ? (
                              <HugeiconsIcon
                                icon={Tick02Icon}
                                className="absolute -right-0.5 -bottom-0.5 size-2.5 text-primary"
                                strokeWidth={2.5}
                              />
                            ) : null}
                          </TooltipTrigger>
                          <TooltipContent>{entry.label}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </TooltipProvider>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export { CategoryIconPicker };
