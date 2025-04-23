import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useState } from "react";
import { TransactionCategoryImportDialog } from "./TransactionCategoryImportDialog";

export function TransactionCategoryImportButton() {
  const [showImportDialog, setShowImportDialog] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowImportDialog(true)}
      >
        <Upload className="w-4 h-4" /> Import
      </Button>
      <TransactionCategoryImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />
    </>
  );
}
