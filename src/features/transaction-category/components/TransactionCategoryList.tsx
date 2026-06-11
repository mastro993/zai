import { EmptyView } from "@/components/views/EmptyView";
import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTransactionCategories } from "../queries/useTransactionCategories";
import { useSelectionStore } from "../stores/selection";
import { TransactionCategoryListItem } from "./TransactionCategoryListItem";

export const TransactionCategoryList = () => {
  const { data: transactionCategories } = useTransactionCategories();
  const { setSelectedCategoryIds } = useSelectionStore();

  useHotkeys("mod+a", () => {
    setSelectedCategoryIds(transactionCategories?.map((category) => category.id));
  });

  useEffect(() => {
    return () => {
      setSelectedCategoryIds([]);
    };
  }, [setSelectedCategoryIds]);

  if (transactionCategories?.length === 0) {
    return <EmptyView message="No categories found" />;
  }

  return (
    <ul>
      {transactionCategories?.map((transactionCategory) => {
        return (
          <TransactionCategoryListItem
            key={transactionCategory.id}
            category={transactionCategory}
          />
        );
      })}
    </ul>
  );
};
