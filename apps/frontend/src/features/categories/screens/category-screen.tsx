import { Result } from "@praha/byethrow";
import { useMemo, useState } from "react";
import { toast } from "@/components/toaster/toast";

import { getAffectedBudgets, type BudgetImpact } from "@/commands/errors";
import { ScreenBase } from "@/components/screen-base";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";

import { exportCategories } from "../commands/category-export";
import {
  createTransactionCategory,
  deleteTransactionCategories,
  getTransactionCategories,
  updateTransactionCategory,
} from "../commands/transaction-categories";
import { CategoryDeleteConfirmationDialog } from "../components/category-delete-confirmation-dialog";
import { CategoryBudgetImpactConfirmationDialog } from "../components/category-budget-impact-confirmation-dialog";
import { CategoryFormDrawer } from "../components/category-form-drawer";
import { CategoryImportDialog } from "../components/category-import-dialog";
import { CategoryList, CategoryListSkeleton } from "../components/category-list";
import type { CategoryFormMode } from "../types/category-types";
import type {
  CategoryChildrenDeleteStrategy,
  CategoryFormValues,
  TransactionCategory,
} from "../types/model";

const getChildren = (categories: Array<TransactionCategory>, parentId: string) =>
  categories.filter((category) => category.parentId === parentId);

type CategoryScreenProps = {
  initialCategories: Array<TransactionCategory>;
};

type PendingBudgetImpact =
  | {
      type: "update";
      categoryId: string;
      values: CategoryFormValues;
      budgets: Array<BudgetImpact>;
    }
  | {
      type: "delete";
      category: TransactionCategory;
      childrenStrategy: CategoryChildrenDeleteStrategy;
      budgets: Array<BudgetImpact>;
    };

export function CategoryScreen({ initialCategories }: CategoryScreenProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [formMode, setFormMode] = useState<CategoryFormMode | null>(null);
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TransactionCategory | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pendingBudgetImpact, setPendingBudgetImpact] = useState<PendingBudgetImpact | null>(null);
  const [isConfirmingBudgetImpact, setIsConfirmingBudgetImpact] = useState(false);

  const rootCategories = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories],
  );
  const categoriesInScreenOrder = useMemo(
    () => rootCategories.flatMap((category) => [category, ...getChildren(categories, category.id)]),
    [categories, rootCategories],
  );

  const loadCategories = async () => {
    setIsLoading(true);
    const result = await getTransactionCategories();

    if (Result.isFailure(result)) {
      setErrorMessage(result.error.message);
      setIsLoading(false);
      return false;
    } else {
      setCategories(result.value);
      setErrorMessage(null);
    }

    setIsLoading(false);
    return true;
  };

  const openFormDrawer = (mode: CategoryFormMode) => {
    setFormMode(mode);
    setIsFormDrawerOpen(true);
  };

  const openDeleteDialog = (category: TransactionCategory) => {
    setPendingDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const exportCategoryCsv = async () => {
    setIsExporting(true);

    const result = await exportCategories(categoriesInScreenOrder);

    if (Result.isFailure(result)) {
      toast.error("Failed to export categories", { description: result.error.message });
    } else if (result.value) {
      toast.success("Categories exported", { description: result.value });
    } else {
      toast.info("Category export canceled");
    }

    setIsExporting(false);
  };

  const completeCategoryImport = async (createdCount: number, skippedRows: number) => {
    if (await loadCategories()) {
      toast.success("Categories imported", {
        description: `${createdCount} created, ${skippedRows} skipped`,
      });
    }
  };

  const submitCategory = async (values: CategoryFormValues, confirmBudgetImpact = false) => {
    const result =
      formMode?.type === "edit"
        ? await updateTransactionCategory(formMode.category.id, values, confirmBudgetImpact)
        : await createTransactionCategory(values);

    if (Result.isFailure(result)) {
      const budgets = getAffectedBudgets(result.error);
      if (result.error.code === "budgetImpactConfirmationRequired" && budgets.length > 0) {
        if (formMode?.type === "edit") {
          setPendingBudgetImpact({
            type: "update",
            categoryId: formMode.category.id,
            values,
            budgets,
          });
        }
        return;
      }
      toast.error("Failed to save category", { description: result.error.message });
      return;
    }

    setIsFormDrawerOpen(false);
    if (await loadCategories()) {
      toast.success("Category saved");
    }
  };

  const deleteCategory = async (
    category: TransactionCategory,
    childrenStrategy: CategoryChildrenDeleteStrategy,
    confirmBudgetImpact = false,
  ) => {
    setIsDeleting(true);
    const result = await deleteTransactionCategories(
      [category.id],
      childrenStrategy,
      confirmBudgetImpact,
    );

    if (Result.isFailure(result)) {
      const budgets = getAffectedBudgets(result.error);
      if (result.error.code === "budgetImpactConfirmationRequired" && budgets.length > 0) {
        setIsDeleteDialogOpen(false);
        setPendingBudgetImpact({
          type: "delete",
          category,
          childrenStrategy,
          budgets,
        });
        setIsDeleting(false);
        return;
      }
      if (result.error.code === "categoryDeletionBlocked") {
        toast.error("Category deletion blocked", { description: result.error.message });
      } else {
        toast.error("Failed to delete category", { description: result.error.message });
      }
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      return;
    }

    setIsDeleteDialogOpen(false);
    const didLoadCategories = await loadCategories();
    setIsDeleting(false);
    if (didLoadCategories) {
      toast.success("Category deleted");
    }
  };

  const confirmBudgetImpact = async () => {
    if (!pendingBudgetImpact) {
      return;
    }

    setIsConfirmingBudgetImpact(true);
    const result =
      pendingBudgetImpact.type === "update"
        ? await updateTransactionCategory(
            pendingBudgetImpact.categoryId,
            pendingBudgetImpact.values,
            true,
          )
        : await deleteTransactionCategories(
            [pendingBudgetImpact.category.id],
            pendingBudgetImpact.childrenStrategy,
            true,
          );

    if (Result.isFailure(result)) {
      toast.error("Failed to apply category change", { description: result.error.message });
      setIsConfirmingBudgetImpact(false);
      return;
    }

    setPendingBudgetImpact(null);
    setIsConfirmingBudgetImpact(false);
    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
    if (pendingBudgetImpact.type === "update") {
      setIsFormDrawerOpen(false);
    }
    if (await loadCategories()) {
      toast.success(pendingBudgetImpact.type === "update" ? "Category saved" : "Category deleted");
    }
  };

  return (
    <ScreenBase
      actions={
        <>
          <Button
            variant="outline"
            disabled={isLoading}
            onClick={() => setIsImportDialogOpen(true)}
          >
            Import categories
          </Button>
          <Button
            variant="outline"
            disabled={isLoading || isExporting || categoriesInScreenOrder.length === 0}
            onClick={exportCategoryCsv}
          >
            {isExporting ? "Exporting..." : "Export categories"}
          </Button>
          <Button onClick={() => openFormDrawer({ type: "create-root" })}>New category</Button>
        </>
      }
    >
      {errorMessage ? (
        <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <CategoryDeleteConfirmationDialog
        category={pendingDelete}
        open={isDeleteDialogOpen}
        hasChildren={pendingDelete ? getChildren(categories, pendingDelete.id).length > 0 : false}
        isDeleting={isDeleting}
        onOpenChange={setIsDeleteDialogOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        onDelete={() => {
          if (pendingDelete) {
            void deleteCategory(pendingDelete, "block");
          }
        }}
        onDeleteChildren={() => {
          if (pendingDelete) {
            void deleteCategory(pendingDelete, "delete");
          }
        }}
        onPromoteChildren={() => {
          if (pendingDelete) {
            void deleteCategory(pendingDelete, "promote");
          }
        }}
      />

      <CategoryBudgetImpactConfirmationDialog
        open={pendingBudgetImpact !== null}
        budgets={pendingBudgetImpact?.budgets ?? []}
        isConfirming={isConfirmingBudgetImpact}
        onOpenChange={(open) => {
          if (!open && !isConfirmingBudgetImpact) {
            setPendingBudgetImpact(null);
          }
        }}
        onConfirm={() => void confirmBudgetImpact()}
      />

      <CategoryImportDialog
        open={isImportDialogOpen}
        categories={categories}
        onOpenChange={setIsImportDialogOpen}
        onImported={completeCategoryImport}
      />

      {isLoading ? (
        <CategoryListSkeleton />
      ) : rootCategories.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border p-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">No categories yet</p>
            <p className="text-sm text-muted-foreground">
              Create a root category to start organizing transactions.
            </p>
          </div>
          <Button onClick={() => openFormDrawer({ type: "create-root" })}>New category</Button>
        </div>
      ) : (
        <CategoryList
          categories={categories}
          onAddChild={(parentId) => openFormDrawer({ type: "create-child", parentId })}
          onEdit={openFormDrawer}
          onDelete={openDeleteDialog}
        />
      )}

      <Drawer
        open={isFormDrawerOpen}
        onOpenChange={setIsFormDrawerOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            setFormMode(null);
          }
        }}
        swipeDirection="right"
      >
        {formMode ? (
          <CategoryFormDrawer
            key={
              formMode.type === "edit"
                ? formMode.category.id
                : `${formMode.type}:${"parentId" in formMode ? formMode.parentId : "root"}`
            }
            open={isFormDrawerOpen}
            mode={formMode}
            categories={categories}
            onSubmit={submitCategory}
          />
        ) : null}
      </Drawer>
    </ScreenBase>
  );
}
