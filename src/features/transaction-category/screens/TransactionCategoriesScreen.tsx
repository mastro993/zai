import { Navbar } from "@/components/layout/Navbar";
import { closeModal, openModal } from "@/utils/modal";
import { Plus } from "lucide-react";
import { useAddTransactionCategory } from "../api/useAddTransactionCategory";
import { useTransactionCategories } from "../api/useTransactionCategories";
import {
  TRANSACTION_CATEGORY_FORM_MODAL_ID,
  TransactionCategoryFormModal,
} from "../components/TransactionCategoryFormModal";
import { TransactionCategoryItem } from "../components/TransactionCategoryItem";
import { NewTransactionCategory } from "../schema";

export const TransactionCategoriesScreen = () => {
  const { mutate: addTransactionCategory } = useAddTransactionCategory();
  const { data: transactionCategories } = useTransactionCategories();

  const handleAddTransactionCategory = (data: NewTransactionCategory) => {
    addTransactionCategory(data);
    closeModal(TRANSACTION_CATEGORY_FORM_MODAL_ID);
  };

  return (
    <>
      <div>
        <Navbar>
          <h1 className="text-lg text-content">Categories</h1>
          <div className="flex gap-2">
            <button
              className="btn btn-neutral btn-sm"
              onClick={() => openModal(TRANSACTION_CATEGORY_FORM_MODAL_ID)}
            >
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
      <TransactionCategoryFormModal onSubmit={handleAddTransactionCategory} />
    </>
  );
};
