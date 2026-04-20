import { withMetaKey } from "@/lib/handlers";
import { cn } from "@heroui/react";
import { Button, Dropdown } from "@heroui/react";
import { Ellipsis } from "lucide-react";
import { useMemo, useState } from "react";
import { useDeleteTransactionCategoryMutation } from "../mutations/useDeleteTransactionCategoryMutation";
import { useUpdateTransactionCategoryMutation } from "../mutations/useUpdateTransactionCategoryMutation";
import { useSelectionStore } from "../stores/selection";
import type { NewTransactionCategory, TransactionCategory } from "../types";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";
import { TransactionCategoryFormDialog } from "./TransactionCategoryFormDialog";

export type TransactionCategoryItemProps = {
  category: TransactionCategory;
};

export const TransactionCategoryListItem = ({ category }: TransactionCategoryItemProps) => {
  const { selectedCategoryIds, toggleCategory } = useSelectionStore();

  const isSelected = useMemo(
    () => selectedCategoryIds.includes(category.id),
    [selectedCategoryIds, category.id],
  );

  return (
    <li
      className={cn([
        "flex flex-col rounded-none px-4 py-2",
        "bg-background hover:bg-accent/20",
        isSelected && "bg-primary/5 hover:bg-primary/10",
      ])}
      key={category.id}
      onClick={withMetaKey(() => toggleCategory(category.id))}
    >
      <div className={cn(["flex items-center justify-between"])}>
        <div className="flex items-center gap-2 ">
          <TransactionCategoryBadge category={category} />
          <span className="text-sm text-base-content/50 ">{category.description}</span>
        </div>
        <TransactionCategoryItemMenu category={category} />
      </div>
    </li>
  );
};

const TransactionCategoryItemMenu = ({ category }: TransactionCategoryItemProps) => {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const { mutateAsync: deleteTransactionCategory } = useDeleteTransactionCategoryMutation();

  const { mutateAsync: updateTransactionCategory } = useUpdateTransactionCategoryMutation();

  const handleUpdate = async (data: NewTransactionCategory) => {
    await updateTransactionCategory(data);
    setShowUpdateDialog(false);
  };

  const handleDelete = async () => {
    await deleteTransactionCategory([category.id]);
  };

  return (
    <div>
      <Dropdown placement="bottom-end">
        <Dropdown.Trigger>
          <Button
            isIconOnly={true}
            variant="light"
            className="shadow-none text-muted-foreground/60"
            aria-label="Edit item"
          >
            <Ellipsis className="size-5" size={20} aria-hidden="true" />
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={(key) => {
              if (key === "edit") setShowUpdateDialog(true);
              if (key === "delete") handleDelete();
            }}
          >
            <Dropdown.Item id="edit">Edit</Dropdown.Item>
            <Dropdown.Item id="delete" variant="danger">
              Delete
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <TransactionCategoryFormDialog
        category={category}
        onSubmit={handleUpdate}
        isOpen={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
      />
    </div>
  );
};
