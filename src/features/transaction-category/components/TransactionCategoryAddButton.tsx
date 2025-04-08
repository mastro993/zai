import { useModal } from "@/components/widgets/Modal";
import { Plus } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { useAddTransactionCategory } from "../api/useAddTransactionCategory";
import { TransactionCategoryFormModal } from "./TransactionCategoryFormModal";

export const TransactionCategoryAddButton = () => {
  const { mutate: addTransactionCategory } = useAddTransactionCategory();

  const [onPresent] = useModal(
    <TransactionCategoryFormModal onSubmit={addTransactionCategory} />
  );

  useHotkeys("mod+n", onPresent);

  return (
    <button className="btn btn-sm btn-primary" onClick={onPresent}>
      <Plus className="w-4 h-4" />
      Add category
    </button>
  );
};
