import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useAddTransactionCategory } from "../api/useAddTransactionCategory";
import { TransactionCategoryFormDialog } from "./TransactionCategoryFormDialog";

export const TransactionCategoryAddButton = () => {
  const [showFormDialog, setShowFormDialog] = useState(false);
  const { mutate: addTransactionCategory } = useAddTransactionCategory();

  useHotkeys("mod+n", () => setShowFormDialog(true));

  return (
    <div>
      <Button size="sm" onClick={() => setShowFormDialog(true)}>
        <Plus /> Add category
      </Button>

      <TransactionCategoryFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        onSubmit={addTransactionCategory}
      />
    </div>
  );
};
