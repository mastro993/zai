import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TrashIcon, X } from "lucide-react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useDeleteTransactionCategoryMutation } from "../api/useDeleteTransactionCategoryMutation";
import { useSelectionStore } from "../stores/selection";

export const TransactionCategorySelection = () => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { selectedCategoryIds, setSelectedCategoryIds } = useSelectionStore();

  const { mutate: deleteMultipleTransactionCategory } =
    useDeleteTransactionCategoryMutation();

  const handleDelete = async () => {
    deleteMultipleTransactionCategory(selectedCategoryIds, {
      onSuccess: () => {
        const length = selectedCategoryIds.length;
        toast.success(
          `${length} ${length === 1 ? "category" : "categories"} deleted`
        );
        setSelectedCategoryIds(undefined);
      },
    });
  };

  useHotkeys("esc", () => {
    setSelectedCategoryIds([]);
  });

  useHotkeys(
    "delete",
    () => selectedCategoryIds.length > 0 && setShowDeleteDialog(true),
    undefined,
    [selectedCategoryIds]
  );

  if (selectedCategoryIds.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          className="ml-auto"
          variant="outline"
          size="sm"
          onClick={() => setSelectedCategoryIds(undefined)}
        >
          <X className="-ms-1 opacity-60" size={16} aria-hidden="true" />
          Clear selection
        </Button>
        <Button
          className="ml-auto"
          variant="outline"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
        >
          <TrashIcon
            className="-ms-1 opacity-60"
            size={16}
            aria-hidden="true"
          />
          Delete
          <span className="-me-1 ms-1 inline-flex h-5 max-h-full items-center rounded border border-border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
            {selectedCategoryIds.length}
          </span>
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              {selectedCategoryIds.length} selected categories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
