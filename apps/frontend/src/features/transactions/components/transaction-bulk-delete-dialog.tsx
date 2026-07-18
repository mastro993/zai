import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

function TransactionBulkDeleteDialog({
  selectedCount,
  open,
  isDeleting,
  onOpenChange,
  onOpenChangeComplete,
  onDelete,
}: {
  selectedCount: number;
  open: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: (open: boolean) => void;
  onDelete: () => void;
}) {
  const countLabel = selectedCount === 1 ? "1 transaction" : `${selectedCount} transactions`;

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      title={`Delete ${countLabel}?`}
      description={`This will permanently delete ${countLabel}. This cannot be undone.`}
      isActionPending={isDeleting}
    >
      <Button variant="destructive" size="sm" disabled={isDeleting} onClick={onDelete}>
        {isDeleting ? "Deleting..." : `Delete ${countLabel}`}
      </Button>
    </ConfirmationDialog>
  );
}

export { TransactionBulkDeleteDialog };
