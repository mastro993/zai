import { Navbar } from "@/components/layout/Navbar";
import { useModal } from "@/hooks/useModal";
import { Plus } from "lucide-react";
import { useAddTransactionCategory } from "../api/useAddTransactionCategory";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { TransactionCategoryForm } from "../components/TransactionCategoryForm";
import { TransactionCategoryItem } from "../components/TransactionCategoryItem";

export const TransactionCategoriesScreen = () => {
  const { mutate: addTransactionCategory } = useAddTransactionCategory();
  const { data: transactionCategories } = useTransactionCategories();

  const { openModal, closeModal, Modal } = useModal({
    title: "New category",
    content: (
      <TransactionCategoryForm
        onSubmit={(data) => {
          addTransactionCategory(data);
          closeModal();
        }}
        onClose={() => closeModal()}
      />
    ),
  });

  return (
    <>
      <div>
        <Navbar>
          <h1 className="text-lg text-content">Categories</h1>
          <div className="flex gap-2">
            <button className="btn btn-neutral btn-sm" onClick={openModal}>
              <Plus className="w-4 h-4" />
              Add category
            </button>
          </div>
        </Navbar>
        <ul className="list">
          {transactionCategories?.map((transactionCategory) => {
            return (
              <TransactionCategoryItem
                key={transactionCategory.id}
                category={transactionCategory}
              />
            );
          })}
        </ul>
      </div>
      <Modal />
    </>
  );
};
