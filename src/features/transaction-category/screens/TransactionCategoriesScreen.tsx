import { Navbar } from "@/components/ui/Navbar";
import { useModal } from "@/components/widgets/Modal";
import { Plus } from "lucide-react";
import { useAddTransactionCategory } from "../api/useAddTransactionCategory";
import { TransactionCategoriesMenu } from "../components/TransactionCategoriesMenu";
import { TransactionCategoriesSelection } from "../components/TransactionCategoriesSelection";
import { TransactionCategoryFormModal } from "../components/TransactionCategoryFormModal";
import { TransactionCategoryList } from "../components/TransactionCategoryList";

export const TransactionCategoriesScreen = () => {
  const { mutate: addTransactionCategory } = useAddTransactionCategory();

  const [onPresent] = useModal(
    <TransactionCategoryFormModal onSubmit={addTransactionCategory} />
  );

  const navbarActions = (
    <div className="flex gap-2">
      <TransactionCategoriesSelection />
      <button className="btn btn-sm btn-primary" onClick={onPresent}>
        <Plus className="w-4 h-4" />
        Add category
      </button>
      <TransactionCategoriesMenu />
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      <Navbar title="Categories" actions={navbarActions} />
      <TransactionCategoryList />
    </div>
  );
};
