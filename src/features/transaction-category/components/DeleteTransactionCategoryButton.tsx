import { useConfirmationModal } from "@/hooks/useConfirmationModal";
import { Trash } from "lucide-react";
import { useDeleteTransactionCategory } from "../api/useDeleteTransactionCategory";
import { TransactionCategory } from "../schema";

type DeleteTransactionCategoryButtonProps = {
  category: TransactionCategory;
};

export const DeleteTransactionCategoryButton = ({
  category,
}: DeleteTransactionCategoryButtonProps) => {
  const { mutate: deleteTransactionCategory } =
    useDeleteTransactionCategory(category);

  const handleDelete = () => {
    deleteTransactionCategory();
  };

  const { openModal, ConfirmationModal } = useConfirmationModal({
    title: `Delete "${category.name}" category`,
    content: "Are you sure you want to delete this category?",
    onConfirm: handleDelete,
    destructive: true,
  });

  return (
    <>
      <button className="btn btn-sm btn-square" onClick={openModal}>
        <Trash className="size-4" />
      </button>
      <ConfirmationModal />
    </>
  );
};
