import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

import type { Transaction } from "../types/model";

function TransactionDeleteConfirmationDialog({
  transaction,
  isDeleting,
  onOpenChange,
  onDelete,
}: {
  transaction: Transaction | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <ConfirmationDialog
      open={transaction !== null}
      onOpenChange={onOpenChange}
      title="Delete transaction?"
      description={
        transaction?.description
          ? `This will permanently delete "${transaction.description}".`
          : "This will permanently delete this transaction."
      }
      isActionPending={isDeleting}
    >
      <Button variant="destructive" size="sm" disabled={isDeleting} onClick={onDelete}>
        {isDeleting ? "Deleting..." : "Delete transaction"}
      </Button>
    </ConfirmationDialog>
  );
}

export { TransactionDeleteConfirmationDialog };
