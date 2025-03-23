import { useModal } from "@/components/widgets/Modal";
import { Download, EllipsisVertical, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { useExportCategories } from "../hooks/useExportCategorites";
import { useImportCategories } from "../hooks/useImportCategories";
import { TransactionCategoryExportModal } from "./TransactionCategoryExportModal";

export const TransactionCategoriesMenu = () => {
  const { data: transactionCategories } = useTransactionCategories();
  const exportCategories = useExportCategories({
    data: transactionCategories,
    onSuccess: () => toast.success("Categories exported successfully"),
  });

  const importCategories = useImportCategories();

  const [onPresentExportModal] = useModal(<TransactionCategoryExportModal />);

  return (
    <div className="dropdown dropdown-hover dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm btn-square btn-soft"
      >
        <EllipsisVertical className="w-4 h-4" />
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu bg-base-200 rounded-box z-1 w-52 p-2 shadow-sm"
      >
        <li>
          <a onClick={importCategories}>
            <Download className="w-4 h-4" />
            Import categories
          </a>
        </li>
        <li>
          <a onClick={onPresentExportModal}>
            <Upload className="w-4 h-4" />
            Export categories
          </a>
        </li>
      </ul>
    </div>
  );
};
