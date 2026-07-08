import { Result } from "@praha/byethrow";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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

  const submitCategory = async (values: CategoryFormValues) => {
    const result =
      formMode?.type === "edit"
        ? await updateTransactionCategory(formMode.category.id, values)
        : await createTransactionCategory(values);

    if (Result.isFailure(result)) {
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
  ) => {
    setIsDeleting(true);
    const result = await deleteTransactionCategories([category.id], childrenStrategy);

    if (Result.isFailure(result)) {
      toast.error("Failed to delete category", { description: result.error.message });
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

  return (
    <section className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Group cash flow with root categories and one child level.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={isLoading}
            onClick={() => setIsImportDialogOpen(true)}
          >
            Import categories
          </Button>
          <Button variant="outline" disabled={isLoading || isExporting} onClick={exportCategoryCsv}>
            {isExporting ? "Exporting..." : "Export categories"}
          </Button>
          <Button onClick={() => openFormDrawer({ type: "create-root" })}>New category</Button>
        </div>
      </div>

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
            mode={formMode}
            categories={categories}
            onSubmit={submitCategory}
          />
        ) : null}
      </Drawer>
    </section>
  );
}
