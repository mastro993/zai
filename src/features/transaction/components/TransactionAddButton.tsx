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
      category_id: 1,
      notes: "Test",
    });
  };

  useHotkeys("mod+n", () => {
    handleAddTransaction();
  });

  return (
    <button className="btn btn-sm btn-primary" onClick={handleAddTransaction}>
      <Plus className="w-4 h-4" />
      Add transaction
    </button>
  );
};
