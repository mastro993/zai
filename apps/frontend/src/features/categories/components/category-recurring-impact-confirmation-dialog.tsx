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
  const budgets = preview?.affectedBudgets ?? [];
  const isBlocked = preview?.blockedByCurrentBudget ?? false;
  const hasRecurringImpact = affected.length > 0;
  const description = isBlocked
    ? "This category cannot be deleted because a current budget selects it directly."
    : [
        hasRecurringImpact ? "Future recurring occurrences will be uncategorized." : null,
        budgets.length > 0 ? "Affected budgets will be recalculated." : null,
      ]
        .filter(Boolean)
        .join(" ");

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isBlocked
          ? "Category deletion blocked"
          : category
            ? `Delete ${category.name}?`
            : "Delete category?"
      }
      description={description}
      cancelLabel={isBlocked ? "Close" : "Cancel"}
      isActionPending={isConfirming}
    >
      <div
        className="col-span-full border bg-muted/40 p-3 text-sm"
        role="status"
        aria-live="polite"
      >
        {isBlocked ? <p className="mb-2 font-medium">Deletion blocked</p> : null}
        {affected.length > 0 ? (
          <div>
            <p className="mb-2 font-medium">Affected recurring transactions</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {affected.map((item) => (
                <li key={item.recurringTransactionId}>{item.description}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {budgets.length > 0 ? (
          <div className={affected.length > 0 ? "mt-3" : undefined}>
            <p className="mb-2 font-medium">Affected budgets</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {budgets.map((budget) => (
                <li key={budget.id}>{budget.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {!isBlocked ? (
        <Button variant="destructive" size="sm" disabled={isConfirming} onClick={onConfirm}>
          {isConfirming ? "Deleting..." : "Continue and delete"}
        </Button>
      ) : null}
    </ConfirmationDialog>
  );
}

export { CategoryRecurringImpactConfirmationDialog };
