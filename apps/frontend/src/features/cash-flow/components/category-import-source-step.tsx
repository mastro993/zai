import { HugeiconsIcon } from "@hugeicons/react";
import { Csv01Icon, File01Icon, Loading03Icon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { CategoryImportFile } from "../commands/category-import";

export function CategoryImportSourceStep({
  file,
  rowCount,
  isPickingFile,
  onSelectFile,
}: {
  file: CategoryImportFile | null;
  rowCount: number;
  isPickingFile: boolean;
  onSelectFile: () => void;
}) {
  if (!file) {
    return (
      <button
        type="button"
        disabled={isPickingFile}
        onClick={onSelectFile}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 border border-dashed border-border px-6 py-14 text-center outline-none transition-colors",
          "hover:border-primary/50 hover:bg-muted/40 focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-70",
        )}
      >
        <span className="flex size-11 items-center justify-center border border-border bg-muted/50 text-muted-foreground">
          <HugeiconsIcon
            icon={isPickingFile ? Loading03Icon : Csv01Icon}
            className={cn("size-5", isPickingFile && "animate-spin")}
            strokeWidth={1.8}
          />
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {isPickingFile ? "Opening file picker…" : "Select a CSV file"}
          </span>
          <span className="text-xs text-muted-foreground">
            A comma-separated list of category names, parents, and optional colors.
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 border border-border p-3">
      <span className="flex size-10 shrink-0 items-center justify-center border border-border bg-muted/50 text-muted-foreground">
        <HugeiconsIcon icon={File01Icon} className="size-5" strokeWidth={1.8} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-foreground">{file.name}</span>
          <Badge variant="outline" className="shrink-0 uppercase">
            CSV
          </Badge>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3 pl-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {rowCount.toLocaleString()} {rowCount === 1 ? "row" : "rows"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPickingFile}
          onClick={onSelectFile}
        >
          Change
        </Button>
      </div>
    </div>
  );
}
