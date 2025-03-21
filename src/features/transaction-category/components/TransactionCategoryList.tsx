import { useHotkeys } from "react-hotkeys-hook";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { useSelectionStore } from "../stores/selection";
import { TransactionCategoryItem } from "./TransactionCategoryItem";

export const TransactionCategoryList = () => {
  const { data: transactionCategories } = useTransactionCategories();
  const { setSelectedCategoryIds } = useSelectionStore();

  useHotkeys("mod+a", () => {
    setSelectedCategoryIds(
      transactionCategories?.map((category) => category.id)
    );
  });

  return (
    <ul className="list">
      {transactionCategories?.map((transactionCategory) => {
        return (
          <TransactionCategoryItem
            key={transactionCategory.id}
            category={transactionCategory}
          />
        );
      })}
    </ul>
  );
};
