import { useModal } from "@/components/Modal";
import { useConfirmationModal } from "@/hooks/useConfirmationModal";
import { PencilIcon, TrashIcon } from "lucide-react";
import { useDeleteTransactionCategory } from "../api/useDeleteTransactionCategory";
import { useUpdateTransactionCategory } from "../api/useUpdateTransactionCategory";
import { TransactionCategory, TransactionCategoryUpdate } from "../schema";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";
import { TransactionCategoryFormModal } from "./TransactionCategoryFormModal";

export type TransactionCategoryItemProps = {
  category: TransactionCategory;
};

export const TransactionCategoryItem = ({
  category,
}: TransactionCategoryItemProps) => {
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
      className="list-row flex items-center justify-between"
      key={category.id}
      contextMenu="ddd"
    >
      <div className="flex items-center gap-2">
        <TransactionCategoryBadge category={category} />
        <span className="text-sm text-base-content/50 ">
          {category.description}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn btn-sm btn-square btn-ghost"
          onClick={onPresentDeleteModal}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
        <button
          className="btn btn-sm btn-square btn-ghost"
          onClick={onPresentUpdateModal}
        >
          <PencilIcon className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
};
