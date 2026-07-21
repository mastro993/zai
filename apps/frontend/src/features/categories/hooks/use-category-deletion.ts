import { Result } from "@praha/byethrow";
import { useState } from "react";
import { toast } from "@/components/toaster/toast";

import { getAffectedBudgets } from "@/commands/errors";

import {
  deleteTransactionCategories,
  previewDeleteTransactionCategories,
} from "../commands/transaction-categories";
import type {
  CategoryChildrenDeleteStrategy,
  CategoryDeletionPreview,
  TransactionCategory,
} from "../types/model";

export type CategoryDeleteBudgetImpact = {
  type: "delete";
  category: TransactionCategory;
  childrenStrategy: CategoryChildrenDeleteStrategy;
  budgets: Array<{ id: string; name: string }>;
};

type PendingRecurringImpact = {
  category: TransactionCategory;
  childrenStrategy: CategoryChildrenDeleteStrategy;
  preview: CategoryDeletionPreview;
};

type DeleteOutcome = "budget" | "failed" | "deleted";

export function useCategoryDeletion({
  loadCategories,
  onBudgetImpact,
}: {
  loadCategories: () => Promise<boolean>;
  onBudgetImpact: (impact: CategoryDeleteBudgetImpact) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<TransactionCategory | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPreviewingDelete, setIsPreviewingDelete] = useState(false);
  const [pendingRecurringImpact, setPendingRecurringImpact] =
    useState<PendingRecurringImpact | null>(null);
  const [isConfirmingRecurringImpact, setIsConfirmingRecurringImpact] = useState(false);

  const openDeleteDialog = (category: TransactionCategory) => {
    setPendingDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const deleteCategory = async (
    category: TransactionCategory,
    childrenStrategy: CategoryChildrenDeleteStrategy,
  ): Promise<DeleteOutcome> => {
    setIsDeleting(true);
    const result = await deleteTransactionCategories([category.id], childrenStrategy);

    if (Result.isFailure(result)) {
      const budgets = getAffectedBudgets(result.error);
      if (result.error.code === "budgetImpactConfirmationRequired" && budgets.length > 0) {
        setIsDeleteDialogOpen(false);
        onBudgetImpact({ type: "delete", category, childrenStrategy, budgets });
        setIsDeleting(false);
        return "budget";
      }
      if (result.error.code === "categoryDeletionBlocked") {
        toast.error("Category deletion blocked", { description: result.error.message });
      } else {
        toast.error("Failed to delete category", { description: result.error.message });
      }
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      return "failed";
    }

    setIsDeleteDialogOpen(false);
    const didLoadCategories = await loadCategories();
    setIsDeleting(false);
    if (didLoadCategories) {
      toast.success("Category deleted");
    }
    return "deleted";
  };

  const previewCategoryDeletion = async (
    category: TransactionCategory,
    childrenStrategy: CategoryChildrenDeleteStrategy,
  ) => {
    setIsPreviewingDelete(true);
    const result = await previewDeleteTransactionCategories([category.id], childrenStrategy);
    setIsPreviewingDelete(false);

    if (Result.isFailure(result)) {
      toast.error("Failed to check category deletion", { description: result.error.message });
      setIsDeleteDialogOpen(false);
      return;
    }

    if (result.value.affectedRecurringTransactions.length > 0) {
      setIsDeleteDialogOpen(false);
      setPendingRecurringImpact({ category, childrenStrategy, preview: result.value });
      return;
    }

    await deleteCategory(category, childrenStrategy);
  };

  const confirmRecurringImpact = async () => {
    if (!pendingRecurringImpact) {
      return;
    }

    setIsConfirmingRecurringImpact(true);
    const outcome = await deleteCategory(
      pendingRecurringImpact.category,
      pendingRecurringImpact.childrenStrategy,
    );
    setIsConfirmingRecurringImpact(false);
    if (outcome !== "failed") {
      setPendingRecurringImpact(null);
    }
  };

  return {
    pendingDelete,
    isDeleteDialogOpen,
    isDeleting,
    isPreviewingDelete,
    pendingRecurringImpact,
    isConfirmingRecurringImpact,
    openDeleteDialog,
    previewCategoryDeletion,
    confirmRecurringImpact,
    setIsDeleteDialogOpen,
    setPendingRecurringImpact,
    handleDeleteDialogOpenChangeComplete: (open: boolean) => {
      if (!open) {
        setPendingDelete(null);
      }
    },
  };
}
