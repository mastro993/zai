import { cn } from "@/lib/utils";

import { getCategoryBadgeColors } from "../lib/category-color";
import { CATEGORY_COLORS, type CategoryColor } from "../types/model";

const COLOR_LABELS = [
  "Orange",
  "Yellow",
  "Lime",
  "Green",
  "Teal",
  "Blue",
  "Indigo",
  "Violet",
  "Pink",
  "Neutral",
] as const;

function CategoryColorSwatch({
  color,
  isSelected,
  onSelect,
}: {
  color: CategoryColor;
  isSelected: boolean;
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
      className={cn(
        "relative flex aspect-square min-h-11 min-w-11 items-center justify-center rounded-(--radius) border-2 border-border/50 text-sm font-semibold transition-[border-color,box-shadow] duration-150",
        "hover:border-foreground/40 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isSelected ? "border-foreground" : null,
      )}
      style={{ backgroundColor: background, color: foreground }}
      onClick={() => onSelect(color)}
    >
      Aa
    </button>
  );
}

function CategoryColorPicker({
  value,
  onChange,
}: {
  value: CategoryColor;
  onChange: (color: CategoryColor) => void;
}) {
  const choices: ReadonlyArray<CategoryColor> = CATEGORY_COLORS;

  return (
    <div className="grid grid-cols-5 gap-2" role="group" aria-label="Category colors">
      {choices.map((color) => (
        <CategoryColorSwatch
          key={color ?? "neutral"}
          color={color}
          isSelected={value === color}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}

export { CategoryColorPicker };
