import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { withMetaKey } from "@/lib/handlers";
import { cn } from "@/lib/utils";
import { Button, Dropdown, DropdownItem, DropdownTrigger } from "@heroui/react";
import { Ellipsis } from "lucide-react";
import { useMemo, useState } from "react";
import { useDeleteTransactionCategoryMutation } from "../mutations/useDeleteTransactionCategoryMutation";
import { useUpdateTransactionCategoryMutation } from "../mutations/useUpdateTransactionCategoryMutation";
import { useSelectionStore } from "../stores/selection";
import { NewTransactionCategory, TransactionCategory } from "../types";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";
import { TransactionCategoryFormDialog } from "./TransactionCategoryFormDialog";

export type TransactionCategoryItemProps = {
  category: TransactionCategory;
};

export const TransactionCategoryListItem = ({
  category,
}: TransactionCategoryItemProps) => {
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
          <span className="text-sm text-base-content/50 ">
            {category.description}
          </span>
        </div>
        <TransactionCategoryItemMenu category={category} />
      </div>
    </li>
  );
};

const TransactionCategoryItemMenu = ({
  category,
}: TransactionCategoryItemProps) => {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const { mutateAsync: deleteTransactionCategory } =
    useDeleteTransactionCategoryMutation();

  const { mutateAsync: updateTransactionCategory } =
    useUpdateTransactionCategoryMutation();

  const handleUpdate = async (data: NewTransactionCategory) => {
    await updateTransactionCategory(data);
    setShowUpdateDialog(false);
  };

  const handleDelete = async () => {
    await deleteTransactionCategory([category.id]);
  };

  return (
    <div>
      <Dropdown placement="bottom-end" backdrop="blur">
        <DropdownTrigger>
          <Button
            isIconOnly={true}
            variant="light"
            className="shadow-none text-muted-foreground/60"
            aria-label="Edit item"
          >
            <Ellipsis className="size-5" size={20} aria-hidden="true" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu>
          <DropdownItem key="edit" onPress={() => setShowUpdateDialog(true)}>
            Edit
          </DropdownItem>
          <DropdownItem
            key="delete"
            className="text-danger"
            color="danger"
            onPress={handleDelete}
          >
            Delete
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      <TransactionCategoryFormDialog
        category={category}
        onSubmit={handleUpdate}
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
      />
    </div>
  );
};
