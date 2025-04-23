import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useAddTransactionCategory } from "../api/useAddTransactionCategory";
import { NewTransactionCategory } from "../schema";
import { TransactionCategoryFormDialog } from "./TransactionCategoryFormDialog";

export const TransactionCategoryAddButton = () => {
  const [showFormDialog, setShowFormDialog] = useState(false);
  const { mutate: addTransactionCategory } = useAddTransactionCategory();

  const handleSubmit = (data: NewTransactionCategory) => {
    addTransactionCategory(data);
    setShowFormDialog(false);
  };

  useHotkeys("mod+n", () => setShowFormDialog(true));

  return (
    <>
      <Button size="sm" onClick={() => setShowFormDialog(true)}>
        <Plus /> Add category
      </Button>

      <TransactionCategoryFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        onSubmit={handleSubmit}
      />
    </>
  );
};
