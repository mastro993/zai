import { useConfirmationModal } from "@/hooks/useConfirmationModal";
import { useModal } from "@/hooks/useModal";
import { Pencil, Trash } from "lucide-react";
import { useDeleteTransactionCategory } from "../api/useDeleteTransactionCategory";
import { useUpdateTransactionCategory } from "../api/useUpdateTransactionCategory";
import { TransactionCategory, TransactionCategoryUpdate } from "../schema";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";
import { TransactionCategoryForm } from "./TransactionCategoryForm";

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

  const deleteConfirmationModal = useConfirmationModal({
    title: `Delete "${category.name}" category`,
    content: "Are you sure you want to delete this category?",
    onConfirm: handleDelete,
    destructive: true,
  });

  const updateModal = useModal({
    title: "Update category",
    content: (
      <TransactionCategoryForm
        category={category}
        onSubmit={(data) => {
          updateModal.close();
          handleUpdate(data);
        }}
      />
    ),
  });

  return (
    <>
      <li
        className="list-row flex items-center justify-between bg-base-100"
        key={category.id}
      >
        <div className="flex items-center gap-2">
          <TransactionCategoryBadge
            name={category.name}
            color={category.color}
          />
          <span className="text-sm text-base-content/50 ">
            {category.description}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm btn-square" onClick={updateModal.open}>
            <Pencil className="size-4" />
          </button>
          <button
            className="btn btn-sm btn-square"
            onClick={deleteConfirmationModal.open}
          >
            <Trash className="size-4" />
          </button>
        </div>
      </li>
      <updateModal.Modal />
      <deleteConfirmationModal.Modal />
    </>
  );
};
