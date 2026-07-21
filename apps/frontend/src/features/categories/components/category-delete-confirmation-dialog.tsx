import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

import type { TransactionCategory } from "../types/model";

function CategoryDeleteConfirmationDialog({
  category,
  open,
  hasChildren,
  isActionPending,
  pendingLabel,
  onOpenChange,
  onOpenChangeComplete,
  onDelete,
  onDeleteChildren,
  onPromoteChildren,
}: {
  category: TransactionCategory | null;
  open: boolean;
  hasChildren: boolean;
  isActionPending: boolean;
  pendingLabel: string;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: (open: boolean) => void;
  onDelete: () => void;
  onDeleteChildren: () => void;
  onPromoteChildren: () => void;
}) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      title={category ? `Delete ${category.name}?` : "Delete category?"}
      description={
        hasChildren
          ? "This category has child categories. Choose what should happen to them."
          : "This will permanently delete this category."
      }
      isActionPending={isActionPending}
    >
      {hasChildren ? (
        <>
          <Button
            variant="destructive"
            size="sm"
            disabled={isActionPending}
            onClick={onDeleteChildren}
          >
            {isActionPending ? pendingLabel : "Delete children"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isActionPending}
            onClick={onPromoteChildren}
          >
            Promote children
          </Button>
        </>
      ) : (
        <Button variant="destructive" size="sm" disabled={isActionPending} onClick={onDelete}>
          {isActionPending ? pendingLabel : "Delete category"}
        </Button>
      )}
    </ConfirmationDialog>
  );
}

export { CategoryDeleteConfirmationDialog };
