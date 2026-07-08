import { useMemo } from "react";

import { cn } from "@/lib/utils";

import { toPastelColor } from "../lib/category-color";

function CategoryColorSwatch({
  color,
  isSelected,
  label,
  onSelect,
}: {
  color: string;
  isSelected: boolean;
  label: string;
  onSelect: (color: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isSelected}
      className={cn(
        "aspect-square w-full min-w-0 border border-border transition-[box-shadow,transform] duration-150",
        "hover:border-foreground/40 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isSelected ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : null,
      )}
      style={{ backgroundColor: color }}
      onClick={() => onSelect(color)}
    />
  );
}

function CategoryColorRow({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: ReadonlyArray<string>;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-10 gap-2" role="group" aria-label={label}>
      {colors.map((color) => (
        <CategoryColorSwatch
          key={color}
          color={color}
          isSelected={value === color}
          label={`Select color ${color}`}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}

function CategoryColorPicker({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (color: string) => void;
  colors: ReadonlyArray<string>;
}) {
  const pastelColors = useMemo(() => colors.map(toPastelColor), [colors]);

  return (
    <div className="flex flex-col gap-2">
      <CategoryColorRow
        label="Saturated category colors"
        colors={colors}
        value={value}
        onChange={onChange}
      />
      <CategoryColorRow
        label="Pastel category colors"
        colors={pastelColors}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export { CategoryColorPicker };
