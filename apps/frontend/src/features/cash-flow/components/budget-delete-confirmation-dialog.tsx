import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

import type { Budget } from "../types/budget";

export function BudgetDeleteConfirmationDialog({
  budget,
  open,
  isDeleting,
  onOpenChange,
  onOpenChangeComplete,
  onDelete,
}: {
  budget: Budget | null;
  open: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: (open: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      title={budget ? `Delete ${budget.name}?` : "Delete budget?"}
      description="This hides the budget from normal views. Its identity, categories, transactions, and history remain retained and cannot be restored."
      isActionPending={isDeleting}
    >
      <Button variant="destructive" size="sm" disabled={isDeleting} onClick={onDelete}>
        {isDeleting ? "Deleting..." : "Delete budget"}
      </Button>
    </ConfirmationDialog>
  );
}
