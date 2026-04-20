import { Button } from "@heroui/react";
import { TrashIcon, X } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { useDeleteTransactionCategoryMutation } from "../mutations/useDeleteTransactionCategoryMutation";
import { useSelectionStore } from "../stores/selection";

export const TransactionCategorySelection = () => {
  const { selectedCategoryIds, setSelectedCategoryIds } = useSelectionStore();

  const { mutate: deleteMultipleTransactionCategory } = useDeleteTransactionCategoryMutation();

  const handleDelete = async () => {
    deleteMultipleTransactionCategory(selectedCategoryIds, {
      onSuccess: () => {
        setSelectedCategoryIds(undefined);
      },
    });
  };

  useHotkeys("esc", () => {
    setSelectedCategoryIds([]);
  });

  useHotkeys("delete", () => selectedCategoryIds.length > 0 && handleDelete(), undefined, [
    selectedCategoryIds,
  ]);

  if (selectedCategoryIds.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          className="ml-auto"
          variant="bordered"
          onPress={() => setSelectedCategoryIds(undefined)}
        >
          <X className="-ms-1 opacity-60" size={16} aria-hidden="true" />
          Clear selection
        </Button>
        <Button className="ml-auto" variant="bordered" size="sm" onClick={handleDelete}>
          <TrashIcon className="-ms-1 opacity-60" size={16} aria-hidden="true" />
          Delete
          <span className="-me-1 ms-1 inline-flex h-5 max-h-full items-center rounded border border-border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
            {selectedCategoryIds.length}
          </span>
        </Button>
      </div>
    </>
  );
};
