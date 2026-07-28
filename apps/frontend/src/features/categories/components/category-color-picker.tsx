import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { CATEGORY_HUES, type CategoryHue } from "../types/model";

const HUE_LABELS: Record<number, string> = {
  20: "Red",
  60: "Orange",
  100: "Yellow",
  140: "Green",
  180: "Teal",
  220: "Cyan",
  260: "Blue",
  300: "Violet",
  340: "Pink",
};

const getHueLabel = (hue: CategoryHue) =>
  hue === null ? "Neutral" : (HUE_LABELS[hue] ?? "Custom");

function CategoryColorSwatch({
  hue,
  isSelected,
  onSelect,
}: {
  hue: CategoryHue;
  isSelected: boolean;
  onSelect: (hue: CategoryHue) => void;
}) {
  const label = hue === null ? "Select neutral" : `Select ${getHueLabel(hue)}, ${hue} degrees`;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isSelected}
      className={cn(
        "relative flex aspect-square min-h-11 min-w-11 items-center justify-center border border-border transition-[box-shadow,transform] duration-150",
        "hover:border-foreground/40 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isSelected ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : null,
      )}
      style={{ backgroundColor: hue === null ? "oklch(0.68 0 0)" : `oklch(0.68 0.11 ${hue})` }}
      onClick={() => onSelect(hue)}
    >
      {isSelected ? <Check aria-hidden="true" className="size-4 text-white drop-shadow" /> : null}
    </button>
  );
}

function CategoryColorPicker({
  value,
  onChange,
}: {
  value: CategoryHue;
  onChange: (hue: CategoryHue) => void;
}) {
  const choices: ReadonlyArray<CategoryHue> = [...CATEGORY_HUES, null];

  return (
    <div className="grid grid-cols-5 gap-2" role="group" aria-label="Category hues">
      {choices.map((hue) => (
        <CategoryColorSwatch
          key={hue ?? "neutral"}
          hue={hue}
          isSelected={value === hue}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}

export { CategoryColorPicker };
