import { useModal } from "@/components/Modal";
import { Navbar } from "@/components/Navbar";
import { useExportToFile } from "@/hooks/useExportData";
import { Download, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAddTransactionCategory } from "../api/useAddTransactionCategory";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { TransactionCategoriesSelection } from "../components/TransactionCategoriesSelection";
import { TransactionCategoryFormModal } from "../components/TransactionCategoryFormModal";
import { TransactionCategoryList } from "../components/TransactionCategoryList";

export const TransactionCategoriesScreen = () => {
  const { mutate: addTransactionCategory } = useAddTransactionCategory();
  const { data: transactionCategories } = useTransactionCategories();
  const { isExporting, exportData } = useExportToFile({
    data: transactionCategories,
    filePrefix: "spiccy_transaction_categories",
    onSuccess: () => toast.success("Categories exported successfully"),
  });

  const [onPresent] = useModal(
    <TransactionCategoryFormModal onSubmit={addTransactionCategory} />
  );

  return (
    <div className="flex flex-col">
      <Navbar>
        <h1 className="text-lg text-content">Categories</h1>
        <div className="flex gap-2">
          <TransactionCategoriesSelection />
          <div className="tooltip tooltip-bottom" data-tip="Export categories">
            <div
              className="btn btn-sm btn-square btn-primary btn-soft"
              onClick={exportData}
            >
              {isExporting ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="tooltip tooltip-bottom" data-tip="Import categories">
            <div className="btn btn-sm btn-square btn-primary btn-soft ">
              <Download className="w-4 h-4" />
            </div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={onPresent}>
            <Plus className="w-4 h-4" />
            Add category
          </button>
        </div>
      </Navbar>
      <TransactionCategoryList />
    </div>
  );
};
