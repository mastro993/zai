import { useConfirmationModal } from "@/components/widgets/Modal";
import { TrashIcon, X } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useDeleteTransactionCategory } from "../api/useDeleteTransactionCategory";
import { useSelectionStore } from "../stores/selection";

export const TransactionCategorySelection = () => {
  const { selectedCategoryIds, setSelectedCategoryIds } = useSelectionStore();

  const { mutate: deleteMultipleTransactionCategory } =
    useDeleteTransactionCategory();

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

  const [onPresentDeleteModal] = useConfirmationModal({
    title: `Delete ${selectedCategoryIds.length} categories`,
    description: "Are you sure you want to delete these categories?",
    onConfirm: handleDelete,
    destructive: true,
  });

  useHotkeys(
    "delete",
    () => {
      setSelectedCategoryIds([]);
    },
    undefined,
    [selectedCategoryIds]
  );

  useHotkeys("mod+delete", onPresentDeleteModal, undefined, [
    selectedCategoryIds,
  ]);

  if (selectedCategoryIds.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="join">
        <div className="tooltip tooltip-bottom" data-tip="Clear selection">
          <button
            className="btn btn-sm btn-soft join-item"
            onClick={() => setSelectedCategoryIds(undefined)}
          >
            <X className="w-4 h-4" />
            {selectedCategoryIds.length} selected
          </button>
        </div>
        <div
          className="tooltip tooltip-bottom"
          data-tip="Delete selected categories"
        >
          <button
            className="btn btn-sm btn-soft btn-square join-item"
            onClick={onPresentDeleteModal}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
