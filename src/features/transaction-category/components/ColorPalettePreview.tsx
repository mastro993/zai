import { TransactionCategoryColors, type TransactionCategoryColor } from "../types";
import { getColorHsl, getColorHslShade } from "../utils/colorUtils";

export function ColorPalettePreview() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-default-700 mb-4">Base Colors</h3>
        <div className="grid grid-cols-8 gap-2">
          {TransactionCategoryColors.map((color) => {
            const hsl = getColorHsl(color);
            return (
              <div key={color} className="flex flex-col items-center gap-2">
                <div
                  className="w-12 h-12 rounded-lg border border-default-300 cursor-pointer transition-transform hover:scale-105"
                  style={{ backgroundColor: hsl }}
                  title={color}
                />
                <span className="text-xs text-default-600">{color}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-default-700 mb-4">
          Derived Shades (Sample Child Categories)
        </h3>
        <div className="space-y-4">
          {TransactionCategoryColors.map((parentColor) => (
            <div key={parentColor}>
              <p className="text-xs font-medium text-default-600 mb-2 capitalize">
                {parentColor} Family
              </p>
              <div className="grid grid-cols-12 gap-1">
                {Array.from({ length: 12 }).map((_, index) => {
                  const childId = `${parentColor}-child-${index}`;
                  const derived = getColorHslShade(
                    parentColor as TransactionCategoryColor,
                    childId,
                  );
                  return (
                    <div
                      key={childId}
                      className="h-10 rounded border border-default-300 cursor-pointer transition-transform hover:scale-105"
                      style={{ backgroundColor: derived }}
                      title={`${parentColor} shade ${index + 1}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
