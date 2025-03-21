import { useModal } from "@/components/Modal";
import { useConfirmationModal } from "@/hooks/useConfirmationModal";
import { cn } from "@/utils/style";
import { PencilIcon, TrashIcon } from "lucide-react";
import { useMemo } from "react";
import { useDeleteTransactionCategory } from "../api/useDeleteTransactionCategory";
import { useUpdateTransactionCategory } from "../api/useUpdateTransactionCategory";
import { TransactionCategory, TransactionCategoryUpdate } from "../schema";
import { useSelectionStore } from "../stores/selection";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";
import { TransactionCategoryFormModal } from "./TransactionCategoryFormModal";

export type TransactionCategoryItemProps = {
  category: TransactionCategory;
};

export const TransactionCategoryItem = ({
  category,
}: TransactionCategoryItemProps) => {
  const { selectedCategoryIds, toggleCategory } = useSelectionStore();

  const isSelected = useMemo(
    () => selectedCategoryIds.includes(category.id),
    [selectedCategoryIds, category.id]
  );

  const { mutate: updateTransactionCategory } =
    useUpdateTransactionCategory(category);

  const { mutate: deleteTransactionCategory } =
    useDeleteTransactionCategory(category);

  const handleUpdate = (data: TransactionCategoryUpdate) => {
    updateTransactionCategory(data);
  };

  const handleDelete = () => {
    deleteTransactionCategory();
  };

  const [onPresentDeleteModal] = useConfirmationModal({
    title: `Delete "${category.name}" category`,
    description: "Are you sure you want to delete this category?",
    onConfirm: handleDelete,
    destructive: true,
  });

  const [onPresentUpdateModal] = useModal(
    <TransactionCategoryFormModal category={category} onSubmit={handleUpdate} />
  );
  return (
    <li
      className="list-row flex flex-col py-1"
      key={category.id}
      contextMenu="ddd"
    >
      <div
        className={cn([
          "flex items-center justify-between bg-base-100 py-2 px-3 rounded-box",
          isSelected && "bg-primary/5",
        ])}
      >
        <div className="flex items-center gap-2 ">
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-xs"
            checked={isSelected}
            onChange={() => toggleCategory(category.id)}
          />
          <TransactionCategoryBadge category={category} />
          <span className="text-sm text-base-content/50 ">
            {category.description}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-xs btn-square btn-ghost"
            onClick={onPresentDeleteModal}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
          <button
            className="btn btn-xs btn-square btn-ghost"
            onClick={onPresentUpdateModal}
          >
            <PencilIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  );
};
