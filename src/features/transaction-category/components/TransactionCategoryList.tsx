import { EmptyView } from "@/components/views/EmptyView";
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

  if (transactionCategories?.length === 0) {
    return <EmptyView message="No categories found" />;
  }

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
