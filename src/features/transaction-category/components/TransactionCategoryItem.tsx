import { useModal } from "@/components/Modal";
import { useConfirmationModal } from "@/hooks/useConfirmationModal";
import { ContextMenu } from "@radix-ui/themes";
import { useDeleteTransactionCategory } from "../api/useDeleteTransactionCategory";
import { useUpdateTransactionCategory } from "../api/useUpdateTransactionCategory";
import { TransactionCategory, TransactionCategoryUpdate } from "../schema";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";
import { TransactionCategoryFormModal } from "./TransactionCategoryFormModal";

export type TransactionCategoryItemProps = {
  category: TransactionCategory;
};

export const TransactionCategoryItem = ({
  category,
}: TransactionCategoryItemProps) => {
  const { mutate: updateTransactionCategory } =
    useUpdateTransactionCategory(category);

  const { mutate: deleteTransactionCategory } =
    useDeleteTransactionCategory(category);

  const handleUpdate = (data: TransactionCategoryUpdate) => {
    updateTransactionCategory(data);
  };

  const handleDelete = () => {
    deleteTransactionCategory();
  };

  const [onPresentDeleteModal] = useConfirmationModal({
    title: `Delete "${category.name}" category`,
    content: "Are you sure you want to delete this category?",
    onConfirm: handleDelete,
    destructive: true,
  });

  const [onPresentUpdateModal] = useModal(
    <TransactionCategoryFormModal category={category} onSubmit={handleUpdate} />
  );
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <li
          className="list-row flex items-center justify-between bg-base-100 "
          key={category.id}
        >
          <div className="flex items-center gap-2">
            <TransactionCategoryBadge category={category} />
            <span className="text-sm text-base-content/50 ">
              {category.description}
            </span>
          </div>
        </li>
      </ContextMenu.Trigger>
      <ContextMenu.Content variant="soft">
        <ContextMenu.Item shortcut="⌘ E" onClick={onPresentUpdateModal}>
          Edit
        </ContextMenu.Item>
        <ContextMenu.Item shortcut="⌘ S">Select</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item
          shortcut="⌘ ⌫"
          color="red"
          onClick={onPresentDeleteModal}
        >
          Delete
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
};
