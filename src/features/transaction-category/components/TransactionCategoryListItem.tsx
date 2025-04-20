import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { withMetaKey } from "@/utils/handlers";
import { Ellipsis } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDeleteTransactionCategory } from "../api/useDeleteTransactionCategory";
import { useUpdateTransactionCategory } from "../api/useUpdateTransactionCategory";
import { TransactionCategory, TransactionCategoryUpdate } from "../schema";
import { useSelectionStore } from "../stores/selection";
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
    [selectedCategoryIds, category.id]
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const { mutateAsync: deleteTransactionCategory } =
    useDeleteTransactionCategory();

  const { mutateAsync: updateTransactionCategory } =
    useUpdateTransactionCategory(category);

  const handleUpdate = async (data: TransactionCategoryUpdate) => {
    await updateTransactionCategory(data);
    setShowUpdateDialog(false);
  };

  const handleDelete = async () => {
    await deleteTransactionCategory([category.id]);
    toast.success(`"${category.name}" category deleted`);
    setShowDeleteDialog(false);
  };

  return (
    <div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="shadow-none text-muted-foreground/60"
              aria-label="Edit item"
            >
              <Ellipsis className="size-5" size={20} aria-hidden="true" />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setShowUpdateDialog(true)}>
              Edit
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            variant="destructive"
            className="dark:data-[variant=destructive]:focus:bg-destructive/10"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TransactionCategoryFormDialog
        category={category}
        onSubmit={handleUpdate}
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
