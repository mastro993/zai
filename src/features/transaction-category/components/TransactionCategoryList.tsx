import { ScrollArea } from "@/components/ui/ScrollArea";
import { EmptyView } from "@/components/views/EmptyView";
import { useHotkeys } from "react-hotkeys-hook";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { useSelectionStore } from "../stores/selection";
import { TransactionCategoryListItem } from "./TransactionCategoryListItem";

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
    <div className="overflow-auto">
      <ScrollArea>
        <ul className="list">
          {transactionCategories?.map((transactionCategory) => {
            return (
              <TransactionCategoryListItem
                key={transactionCategory.id}
                category={transactionCategory}
              />
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
};
