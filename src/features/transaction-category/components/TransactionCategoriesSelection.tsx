import { useConfirmationModal } from "@/hooks/useConfirmationModal";
import { TrashIcon, X } from "lucide-react";
import { useDeleteMultipleTransactionCategory } from "../api/useDeleteTransactionCategory";
import { useSelectionStore } from "../stores/selection";

export const TransactionCategoriesSelection = () => {
  const { selectedCategoryIds, setSelectedCategoryIds } = useSelectionStore();

  const { mutate: deleteMultipleTransactionCategory } =
    useDeleteMultipleTransactionCategory(selectedCategoryIds, () =>
      setSelectedCategoryIds(undefined)
    );

  const [onPresentDeleteModal] = useConfirmationModal({
    title: `Delete "${selectedCategoryIds.length}" categories`,
    description: "Are you sure you want to delete these categories?",
    onConfirm: deleteMultipleTransactionCategory,
    destructive: true,
  });

  if (selectedCategoryIds.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="join">
        <button
          className="btn btn-sm btn-soft btn-primary join-item "
          onClick={() => setSelectedCategoryIds(undefined)}
        >
          <X className="w-4 h-4" />
          {selectedCategoryIds.length} selected
        </button>
        <button
          className="btn btn-sm btn-soft btn-square btn-error join-item"
          onClick={onPresentDeleteModal}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
