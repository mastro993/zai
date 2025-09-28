import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useState } from "react";
import { TransactionCategoryExportDialog } from "./TransactionCategoryExportDialog";

export function TransactionCategoryExportButton() {
  const [showExportDialog, setShowExportDialog] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowExportDialog(true)}
      >
        <Upload className="w-4 h-4" /> Export
      </Button>

      <TransactionCategoryExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
    </>
  );
}
