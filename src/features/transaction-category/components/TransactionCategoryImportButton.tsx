import { Button } from "@/components/ui/button";
import { useModal } from "@/components/widgets/Modal";
import { Upload } from "lucide-react";
import { TransactionCategoryImportModal } from "./TransactionCategoryImportModal";

export function TransactionCategoryImportButton() {
  const [onPresentImportModal] = useModal(<TransactionCategoryImportModal />);

  return (
    <Button variant="outline" size="sm" onClick={onPresentImportModal}>
      <Upload className="w-4 h-4" /> Import
    </Button>
  );
}
