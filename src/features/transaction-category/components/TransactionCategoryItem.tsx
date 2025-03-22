import { useModal } from "@/components/widgets/Modal";
import { useConfirmationModal } from "@/hooks/useConfirmationModal";
import { withMetaKey } from "@/utils/handlers";
import { cn } from "@/utils/style";
import { PencilIcon, TrashIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
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

  const { mutateAsync: deleteTransactionCategory } =
    useDeleteTransactionCategory();

  const handleUpdate = (data: TransactionCategoryUpdate) => {
    updateTransactionCategory(data);
  };

  const handleDelete = async () => {
    await deleteTransactionCategory([category.id]);
    toast.success(`"${category.name}" category deleted`);
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
      className={cn([
        "list-row flex flex-col rounded-none",
        "bg-base-100 hover:bg-base-200",
        isSelected && "bg-primary/5 hover:bg-primary/10",
      ])}
      key={category.id}
      onClick={withMetaKey(() => toggleCategory(category.id))}
    >
      <div className={cn(["flex items-center justify-between"])}>
        <div className="flex items-center gap-2 ">
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
