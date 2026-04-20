import { Button, useDisclosure } from "@heroui/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import { useHotkeys } from "react-hotkeys-hook";
import { useCreateTransactionCategoryMutation } from "../mutations/useCreateTransactionCategoryMutation";
import type { NewTransactionCategory } from "../types";
import { TransactionCategoryFormDialog } from "./TransactionCategoryFormDialog";

export const TransactionCategoryAddButton = () => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { mutate: addTransactionCategory } = useCreateTransactionCategoryMutation();

  const handleSubmit = (data: NewTransactionCategory) => {
    addTransactionCategory(data);
    setShowFormDialog(false);
  };

  useHotkeys("mod+n", () => onOpen());

  return (
    <>
      <Button onPress={() => onOpen()}>
        <Icon icon={PlusSignIcon} /> Add category
      </Button>

      <TransactionCategoryFormDialog
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onSubmit={handleSubmit}
      />
    </>
  );
};
