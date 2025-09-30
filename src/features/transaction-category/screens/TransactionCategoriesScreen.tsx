import { Navbar } from "@/components/Navbar";
import { TransactionCategoryAddButton } from "../components/TransactionCategoryAddButton";
import { TransactionCategoryExportButton } from "../components/TransactionCategoryExportButton";
import { TransactionCategoryImportButton } from "../components/TransactionCategoryImportButton";
import { TransactionCategoryList } from "../components/TransactionCategoryList";
import { TransactionCategorySelection } from "../components/TransactionCategorySelection";

export const TransactionCategoriesScreen = () => {
  const navbarActions = (
    <div className="flex gap-2">
      <TransactionCategorySelection />
      <TransactionCategoryImportButton />
      <TransactionCategoryExportButton />
      <TransactionCategoryAddButton />
    </div>
  );

  return (
    <div className="flex flex-col">
      <Navbar title="Categories" actions={navbarActions} />
      <TransactionCategoryList />
    </div>
  );
};
