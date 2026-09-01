import { HugeiconsIcon } from "@hugeicons/react";
import { HexColorInput, HexColorPicker } from "react-colorful";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { getCategoryBadgeColors } from "../lib/category-color";
import {
  DEFAULT_CATEGORY_ICON,
  getCategoryIconEntry,
  type CategoryIcon,
} from "../lib/category-icon";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, type CategoryColor } from "../types/model";

const COLOR_LABELS = [
  "Red",
  "Amber",
  "Lime",
  "Green",
  "Teal",
  "Blue",
  "Violet",
  "Pink",
  "Neutral",
] as const;

const swatchClassName =
  "relative flex aspect-square min-h-11 min-w-11 items-center justify-center rounded-(--radius) border-2 border-border/50 transition-[border-color,box-shadow] duration-150 hover:border-foreground/40 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function CategoryColorSwatch({
  color,
  isSelected,
  icon,
  onSelect,
}: {
  color: CategoryColor;
  isSelected: boolean;
  icon: ReturnType<typeof getCategoryIconEntry>["icon"];
  onSelect: (color: CategoryColor) => void;
}) {
  const colorIndex = CATEGORY_COLORS.findIndex((choice) => choice === color);
  const label =
    colorIndex === -1 ? `Select custom color ${color ?? ""}` : `Select ${COLOR_LABELS[colorIndex]}`;
  const { background, foreground } = getCategoryBadgeColors(color);

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isSelected}
      className={cn(swatchClassName, isSelected ? "border-foreground" : null)}
      style={{ backgroundColor: background, color: foreground }}
      onClick={() => onSelect(color)}
    >
      <HugeiconsIcon icon={icon} className="size-4" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

function CategoryColorPicker({
  value,
  icon = DEFAULT_CATEGORY_ICON,
  onChange,
}: {
  value: CategoryColor;
  icon?: CategoryIcon;
  onChange: (color: CategoryColor) => void;
}) {
  const choices: ReadonlyArray<CategoryColor> = CATEGORY_COLORS;
  const isCustom = value !== null && !choices.includes(value);
  const customColors = isCustom ? getCategoryBadgeColors(value) : null;
  const pickerColor = value ?? DEFAULT_CATEGORY_COLOR;
  const previewIcon = getCategoryIconEntry(icon).icon;

  return (
    <div className="grid grid-cols-5 gap-2" role="group" aria-label="Category colors">
      {choices.map((color) => (
        <CategoryColorSwatch
          key={color ?? "neutral"}
          color={color}
          icon={previewIcon}
          isSelected={value === color}
          onSelect={onChange}
        />
      ))}
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={isCustom ? "Edit custom color" : "Choose custom color"}
              aria-pressed={isCustom}
              className={cn(swatchClassName, isCustom ? "border-foreground" : "border-0")}
              style={
                customColors
                  ? {
                      backgroundColor: customColors.background,
                      color: customColors.foreground,
                    }
                  : {
                      backgroundColor: "var(--background)",
                      color: "var(--foreground)",
                    }
              }
            />
          }
        >
          {isCustom ? null : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60"
              style={{
                backgroundImage:
                  "conic-gradient(from 45deg, #C32828, #C39B28, #75C328, #28C34E, #28C3C3, #284EC3, #7528C3, #C3289B, #C32828)",
              }}
            />
          )}
          <HugeiconsIcon
            icon={previewIcon}
            className={cn("size-4", !isCustom && "relative z-10 text-white")}
            strokeWidth={2}
            aria-hidden="true"
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto" align="end" side="left" sideOffset={8}>
          <PopoverHeader>
            <PopoverTitle>Custom color</PopoverTitle>
            <PopoverDescription>Choose any HEX color.</PopoverDescription>
          </PopoverHeader>
          <div className="flex flex-col gap-2" role="group" aria-label="Custom color picker">
            <HexColorPicker
              color={pickerColor}
              onChange={(color) => onChange(color.toUpperCase())}
            />
            <HexColorInput
              aria-label="Custom color HEX"
              className="h-8 border border-input bg-transparent px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              color={pickerColor}
              prefixed
              onChange={(color) => {
                if (/^#[0-9a-f]{6}$/i.test(color)) {
                  onChange(color.toUpperCase());
                }
              }}
              onBlur={(event) => {
                const shorthand = event.currentTarget.value.match(/^#?([0-9a-f]{3})$/i);
                if (shorthand) {
                  onChange(
                    `#${[...shorthand[1]]
                      .map((character) => `${character}${character}`)
                      .join("")
                      .toUpperCase()}`,
                  );
                }
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { CategoryColorPicker };
