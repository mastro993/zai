import { useModal } from "@/hooks/useModal";
import { Pencil } from "lucide-react";
import { useUpdateTransactionCategory } from "../api/useUpdateTransactionCategory";
import { TransactionCategory, TransactionCategoryUpdate } from "../schema";
import { TransactionCategoryForm } from "./TransactionCategoryForm";

type DeleteTransactionCategoryButtonProps = {
  category: TransactionCategory;
};

export const EditTransactionCategoryButton = ({
  category,
}: DeleteTransactionCategoryButtonProps) => {
  const { mutate: updateTransactionCategory } =
    useUpdateTransactionCategory(category);

  const handleUpdate = (data: TransactionCategoryUpdate) => {
    updateTransactionCategory(data);
  };

  const { openModal, closeModal, Modal } = useModal({
    title: "New category",
    content: (
      <TransactionCategoryForm
        category={category}
        onSubmit={(data) => {
          closeModal();
          handleUpdate(data);
        }}
        onClose={() => closeModal()}
      />
    ),
  });

  return (
    <>
      <button className="btn btn-sm btn-square" onClick={openModal}>
        <Pencil className="size-4" />
      </button>
      <Modal />
    </>
  );
};
