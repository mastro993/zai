import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

import type { TransactionCategory } from "./model";

function CategoryDeleteConfirmationDialog({
  category,
  hasChildren,
  isDeleting,
  onOpenChange,
  onDelete,
  onDeleteChildren,
  onPromoteChildren,
}: {
  category: TransactionCategory;
  hasChildren: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onDeleteChildren: () => void;
  onPromoteChildren: () => void;
}) {
  return (
    <ConfirmationDialog
      open
      onOpenChange={onOpenChange}
      title={`Delete ${category.name}?`}
      description={
        hasChildren
          ? "This category has child categories. Choose what should happen to them."
          : "This will permanently delete this category."
      }
      isActionPending={isDeleting}
    >
      {hasChildren ? (
        <>
          <Button variant="destructive" size="sm" disabled={isDeleting} onClick={onDeleteChildren}>
            {isDeleting ? "Deleting..." : "Delete children"}
          </Button>
          <Button variant="outline" size="sm" disabled={isDeleting} onClick={onPromoteChildren}>
            Promote children
          </Button>
        </>
      ) : (
        <Button variant="destructive" size="sm" disabled={isDeleting} onClick={onDelete}>
          {isDeleting ? "Deleting..." : "Delete category"}
        </Button>
      )}
    </ConfirmationDialog>
  );
}

export { CategoryDeleteConfirmationDialog };
