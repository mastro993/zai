import { Button, Dialog, Flex } from "@radix-ui/themes";
import { useState } from "react";
import { useAddTransactionCategory } from "../api/useAddTransactionCategory";
import { NewTransactionCategory } from "../schema";
import { TransactionCategoryForm } from "./TransactionCategoryForm";

export const AddTransactionCategoryButton = () => {
  const [isOpen, setIsOpen] = useState(true);
  const { mutate: addTransactionCategory } = useAddTransactionCategory();

  const handleAddTransactionCategory = (data: NewTransactionCategory) => {
    addTransactionCategory(data);
  };

  return (
    <Dialog.Root open={true}>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>Edit profile</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Make changes to your profile.
        </Dialog.Description>

        <TransactionCategoryForm onSubmit={handleAddTransactionCategory} />

        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" color="gray" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};
