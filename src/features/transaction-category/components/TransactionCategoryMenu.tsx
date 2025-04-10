import { useModal } from "@/components/widgets/Modal";
import { ChevronDown, Download, Upload } from "lucide-react";
import { TransactionCategoryExportModal } from "./TransactionCategoryExportModal";
import { TransactionCategoryImportModal } from "./TransactionCategoryImportModal";

export const TransactionCategoryMenu = () => {
  const [onPresentExportModal] = useModal(<TransactionCategoryExportModal />);
  const [onPresentImportModal] = useModal(<TransactionCategoryImportModal />);

  return (
    <div className="dropdown dropdown-hover dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm btn-square btn-soft"
      >
        <ChevronDown className="w-4 h-4" />
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu bg-base-200 rounded-box z-1 w-52 p-2 shadow-sm"
      >
        <li>
          <a onClick={onPresentImportModal}>
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
