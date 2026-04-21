import { shouldUseDarkForeground } from "@/utils/color";
import { transactionCategoryPaletteOptions } from "../utils/colorUtils";

export function ColorPalettePreview() {
  return (
    <div className="space-y-4">
      <div className="max-w-xl space-y-1">
        <h3 className="text-sm font-semibold text-default-700">Transaction category palette</h3>
        <p className="text-sm text-default-600">
          Root categories can use these colors. Child categories inherit the parent color.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {transactionCategoryPaletteOptions.map((option) => {
          const useDarkForeground = shouldUseDarkForeground(option.color);

          return (
            <div key={option.id} className="rounded-lg border border-default-300 p-3">
              <div
                className="h-12 rounded-md border border-black/10"
                style={{
                  backgroundColor: option.color,
                  color: useDarkForeground ? "#111827" : "#FFFFFF",
                }}
                title={`${option.label} (${option.color})`}
              />
              <div className="mt-3 grid gap-0.5">
                <span className="text-sm font-medium text-default-700">{option.label}</span>
                <span className="font-mono text-xs text-default-500">{option.color}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
