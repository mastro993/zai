import { DownloadIcon, UploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Result } from "@praha/byethrow";
import { useMemo, useState } from "react";
import { toast } from "@/components/toaster/toast";

import { getAffectedBudgets, type BudgetImpact } from "@/commands/errors";
import { ScreenBase } from "@/components/screen-base";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Drawer } from "@/components/ui/drawer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
import { CategoryRecurringImpactConfirmationDialog } from "../components/category-recurring-impact-confirmation-dialog";
import { useCategoryDeletion } from "../hooks/use-category-deletion";
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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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

  const {
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
    handleDeleteDialogOpenChangeComplete,
  } = useCategoryDeletion({
    loadCategories,
    onBudgetImpact: setPendingBudgetImpact,
  });

  const openFormDrawer = (mode: CategoryFormMode) => {
    setFormMode(mode);
    setIsFormDrawerOpen(true);
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
    if (pendingBudgetImpact.type === "update") {
      setIsFormDrawerOpen(false);
    }
    if (await loadCategories()) {
      toast.success(pendingBudgetImpact.type === "update" ? "Category saved" : "Category deleted");
    }
  };

  const importCategoriesButton = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="Import categories"
      disabled={isLoading}
      onClick={() => setIsImportDialogOpen(true)}
    >
      <HugeiconsIcon icon={UploadIcon} strokeWidth={2} />
    </Button>
  );
  const exportCategoriesButton = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={isExporting ? "Exporting categories" : "Export categories"}
      aria-busy={isExporting}
      disabled={isLoading || isExporting || categoriesInScreenOrder.length === 0}
      onClick={exportCategoryCsv}
    >
      <HugeiconsIcon icon={DownloadIcon} strokeWidth={2} />
    </Button>
  );
  const hasCategories = categories.length > 0;

  return (
    <ScreenBase
      actions={
        <>
          <TooltipProvider>
            <ButtonGroup aria-label="Category file actions">
              <Tooltip>
                <TooltipTrigger render={importCategoriesButton} />
                <TooltipContent>Import categories</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={exportCategoriesButton} />
                <TooltipContent>Export categories</TooltipContent>
              </Tooltip>
            </ButtonGroup>
          </TooltipProvider>
          {hasCategories ? (
            <Button size="sm" onClick={() => openFormDrawer({ type: "create-root" })}>
              New category
            </Button>
          ) : null}
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
        isActionPending={isDeleting || isPreviewingDelete}
        pendingLabel={isPreviewingDelete ? "Checking..." : "Deleting..."}
        onOpenChange={setIsDeleteDialogOpen}
        onOpenChangeComplete={handleDeleteDialogOpenChangeComplete}
        onDelete={() => {
          if (pendingDelete) {
            void previewCategoryDeletion(pendingDelete, "block");
          }
        }}
        onDeleteChildren={() => {
          if (pendingDelete) {
            void previewCategoryDeletion(pendingDelete, "delete");
          }
        }}
        onPromoteChildren={() => {
          if (pendingDelete) {
            void previewCategoryDeletion(pendingDelete, "promote");
          }
        }}
      />

      <CategoryRecurringImpactConfirmationDialog
        category={pendingRecurringImpact?.category ?? null}
        preview={pendingRecurringImpact?.preview ?? null}
        open={pendingRecurringImpact !== null}
        isConfirming={isConfirmingRecurringImpact || isDeleting}
        onOpenChange={(open) => {
          if (!open && !isConfirmingRecurringImpact && !isDeleting) {
            setPendingRecurringImpact(null);
          }
        }}
        onConfirm={() => void confirmRecurringImpact()}
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
      ) : categories.length === 0 ? (
        <section
          aria-labelledby="category-empty-state-title"
          className="flex min-h-72 flex-col items-center justify-center gap-4 border border-dashed px-6 py-10 text-center sm:px-8"
        >
          <div className="flex max-w-md flex-col items-center gap-1.5">
            <h2 id="category-empty-state-title" className="text-base font-medium">
              Set up your categories
            </h2>
            <p className="text-sm text-muted-foreground">
              Create your first spending or income category to organize transactions.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => openFormDrawer({ type: "create-root" })}>New category</Button>
            <Button type="button" variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <HugeiconsIcon icon={UploadIcon} strokeWidth={2} />
              Import categories
            </Button>
          </div>
        </section>
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
