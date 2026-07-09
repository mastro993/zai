import { Button } from "@/components/ui/button";

type TransactionSelectionBarProps = {
  selectedCount: number;
  isDeleting: boolean;
  onDelete: () => void;
  onClearSelection: () => void;
};

function TransactionSelectionBar({
  selectedCount,
  isDeleting,
  onDelete,
  onClearSelection,
}: TransactionSelectionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 border border-border bg-muted/40 px-3 py-2"
    >
      <p className="text-xs font-medium tabular-nums">{selectedCount} selected</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="destructive" size="sm" disabled={isDeleting} onClick={onDelete}>
          Delete
        </Button>
        <Button variant="outline" size="sm" disabled={isDeleting} onClick={onClearSelection}>
          Clear selection
        </Button>
      </div>
    </div>
  );
}

export { TransactionSelectionBar };
