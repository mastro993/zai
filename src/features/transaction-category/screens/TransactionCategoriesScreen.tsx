import { useModal } from "@/components/Modal";
import { Navbar } from "@/components/Navbar";
import { Button, Flex } from "@radix-ui/themes";
import { Plus } from "lucide-react";
import { useAddTransactionCategory } from "../api/useAddTransactionCategory";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { TransactionCategoryFormModal } from "../components/TransactionCategoryFormModal";
import { TransactionCategoryItem } from "../components/TransactionCategoryItem";

export const TransactionCategoriesScreen = () => {
  const { mutate: addTransactionCategory } = useAddTransactionCategory();
  const { data: transactionCategories } = useTransactionCategories();

  const [onPresent] = useModal(
    <TransactionCategoryFormModal onSubmit={addTransactionCategory} />
  );

  return (
    <>
      <Flex direction="column">
        <Navbar>
          <h1 className="text-lg text-content">Categories</h1>
          <Flex gap="2">
            <Button onClick={onPresent}>
              <Plus className="w-4 h-4" />
              Add category
            </Button>
          </Flex>
        </Navbar>
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
      </Flex>
    </>
  );
};
