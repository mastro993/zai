import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

import type { CategoryDeletionPreview, TransactionCategory } from "../types/model";

function CategoryRecurringImpactConfirmationDialog({
  category,
  preview,
  open,
  isConfirming,
  onOpenChange,
  onConfirm,
}: {
  category: TransactionCategory | null;
  preview: CategoryDeletionPreview | null;
  open: boolean;
  isConfirming: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const affected = preview?.affectedRecurringTransactions ?? [];

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? `Delete ${category.name}?` : "Delete category?"}
      description="Future occurrences from these recurring transactions will be uncategorized."
      isActionPending={isConfirming}
    >
      <div
        className="col-span-full border bg-muted/40 p-3 text-sm"
        role="status"
        aria-live="polite"
      >
        <p className="mb-2 font-medium">Affected recurring transactions</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {affected.map((item) => (
            <li key={item.recurringTransactionId}>{item.description}</li>
          ))}
        </ul>
      </div>
      <Button variant="destructive" size="sm" disabled={isConfirming} onClick={onConfirm}>
        {isConfirming ? "Deleting..." : "Continue and delete"}
      </Button>
    </ConfirmationDialog>
  );
}

export { CategoryRecurringImpactConfirmationDialog };
