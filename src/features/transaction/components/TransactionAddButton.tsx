import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { useAddTransaction } from "../api/useAddTransaction";

export const TransactionAddButton = () => {
  const { mutate: addTransaction } = useAddTransaction();

  const handleAddTransaction = () => {
    addTransaction({
      description: "Test",
      amount: 100,
      date: "2021-01-01",
      type: "income",
      notes: "Test",
    });
  };

  useHotkeys("mod+n", () => {
    handleAddTransaction();
  });

  return (
    <Button size="sm" onClick={handleAddTransaction}>
      <Plus size={16} aria-hidden="true" /> Add transaction
    </Button>
  );
};
