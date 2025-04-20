import { Button } from "@/components/ui/button";
import { useModal } from "@/components/widgets/Modal";
import { Download } from "lucide-react";
import { TransactionCategoryExportModal } from "./TransactionCategoryExportModal";

export function TransactionCategoryExportButton() {
  const [onPresentExportModal] = useModal(<TransactionCategoryExportModal />);

  return (
    <Button variant="outline" size="sm" onClick={onPresentExportModal}>
      <Download className="w-4 h-4" /> Export
    </Button>
  );
}
