import { Button, useOverlayState } from "@heroui/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import { useHotkeys } from "react-hotkeys-hook";
import { useCreateTransactionCategoryMutation } from "../mutations/useCreateTransactionCategoryMutation";
import type { NewTransactionCategory } from "../types";
import { TransactionCategoryFormDialog } from "./TransactionCategoryFormDialog";

export const TransactionCategoryAddButton = () => {
  const { isOpen, open, setOpen } = useOverlayState();
  const { mutate: addTransactionCategory } = useCreateTransactionCategoryMutation();

  const handleSubmit = (data: NewTransactionCategory) => {
    addTransactionCategory(data);
    setOpen(false);
  };

  useHotkeys("mod+n", () => open());

  return (
    <>
      <Button onPress={() => open()}>
        <Icon icon={PlusSignIcon} /> Add category
      </Button>

      <TransactionCategoryFormDialog
        isOpen={isOpen}
        onOpenChange={setOpen}
        onSubmit={handleSubmit}
      />
    </>
  );
};
