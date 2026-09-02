import { Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import {
  CATEGORY_ICON_CATALOG,
  CATEGORY_ICON_GROUPS,
  categoryIconMatchesQuery,
  getCategoryIconEntry,
  suggestCategoryIcons,
  type CategoryIcon,
} from "../lib/category-icon";

function IconChoice({
  entry,
  isSelected,
  onSelect,
}: {
  entry: (typeof CATEGORY_ICON_CATALOG)[number];
  isSelected: boolean;
  onSelect: (icon: CategoryIcon) => void;
}) {
  return (
    <button
      type="button"
      aria-label={entry.label}
      aria-pressed={isSelected}
      className={cn(
        "relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "ring-2 ring-ring",
      )}
      onClick={() => onSelect(entry.key)}
    >
      <HugeiconsIcon icon={entry.icon} className="size-4" strokeWidth={2} />
      {isSelected ? (
        <HugeiconsIcon
          icon={Tick02Icon}
          className="absolute -right-0.5 -bottom-0.5 size-2.5 text-primary"
          strokeWidth={2.5}
        />
      ) : null}
    </button>
  );
}

function CategoryIconPicker({
  value,
  effectiveIcon,
  isChild,
  name,
  description,
  onChange,
}: {
  value: CategoryIcon | null;
  effectiveIcon: CategoryIcon;
  isChild: boolean;
  name: string;
  description: string;
  onChange: (icon: CategoryIcon | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchId = useId();
  const selected = getCategoryIconEntry(effectiveIcon);
  const suggestedIcons = useMemo(
    () => suggestCategoryIcons(name, description),
    [name, description],
  );
  const visibleIcons = useMemo(
    () => CATEGORY_ICON_CATALOG.filter((entry) => categoryIconMatchesQuery(entry, query)),
    [query],
  );
  const hasCatalogMatches = visibleIcons.length > 0;
  const selectIcon = (icon: CategoryIcon) => {
    onChange(icon);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
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
        <div className="border-b p-2.5">
          <Field>
            <FieldLabel htmlFor={searchId} className="sr-only">
              Search icons
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <HugeiconsIcon icon={Search01Icon} strokeWidth={2} aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id={searchId}
                type="search"
                placeholder="Search icons"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
              />
            </InputGroup>
          </Field>
        </div>
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
            {suggestedIcons.length === 0 && !hasCatalogMatches ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">No icons match</p>
            ) : (
              <>
                {suggestedIcons.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Suggested</p>
                    <div className="grid grid-cols-8 gap-1">
                      {suggestedIcons.map((entry) => (
                        <IconChoice
                          key={entry.key}
                          entry={entry}
                          isSelected={value === entry.key}
                          onSelect={selectIcon}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                {CATEGORY_ICON_GROUPS.map((group) => {
                  const entries = visibleIcons.filter((entry) => entry.group === group);
                  if (entries.length === 0) {
                    return null;
                  }

                  return (
                    <div key={group} className="flex flex-col gap-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{group}</p>
                      <div className="grid grid-cols-8 gap-1">
                        {entries.map((entry) => (
                          <IconChoice
                            key={entry.key}
                            entry={entry}
                            isSelected={value === entry.key}
                            onSelect={selectIcon}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export { CategoryIconPicker };
