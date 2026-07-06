import { R } from "@praha/byethrow";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import {
  createTransactionCategory,
  deleteTransactionCategories,
  getTransactionCategories,
  updateTransactionCategory,
} from "@/commands/transaction-categories";

import { CategoryCard } from "./category-card";
import { CategoryDeleteConfirmationDialog } from "./category-delete-confirmation-dialog";
import { CategoryFormDrawer } from "./category-form-drawer";
import type { CategoryFormMode } from "./category-types";
import type {
  CategoryChildrenDeleteStrategy,
  CategoryFormValues,
  TransactionCategory,
} from "./model";

const getChildren = (categories: Array<TransactionCategory>, parentId: string) =>
  categories.filter((category) => category.parentId === parentId);

export function CategoryManager() {
  const [categories, setCategories] = useState<Array<TransactionCategory>>([]);
  const [formMode, setFormMode] = useState<CategoryFormMode | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TransactionCategory | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const rootCategories = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories],
  );

  const loadCategories = async () => {
    setIsLoading(true);
    const result = await getTransactionCategories();

    if (R.isFailure(result)) {
      setErrorMessage(result.error.message);
    } else {
      setCategories(result.value);
      setErrorMessage(null);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const submitCategory = async (values: CategoryFormValues) => {
    const result =
      formMode?.type === "edit"
        ? await updateTransactionCategory(formMode.category.id, values)
        : await createTransactionCategory(values);

    if (R.isFailure(result)) {
      setErrorMessage(result.error.message);
      return;
    }

    setFormMode(null);
    await loadCategories();
  };

  const deleteCategory = async (
    category: TransactionCategory,
    childrenStrategy: CategoryChildrenDeleteStrategy,
  ) => {
    setIsDeleting(true);
    const result = await deleteTransactionCategories([category.id], childrenStrategy);

    if (R.isFailure(result)) {
      setErrorMessage(result.error.message);
      setPendingDelete(null);
      setIsDeleting(false);
      return;
    }

    setPendingDelete(null);
    await loadCategories();
    setIsDeleting(false);
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
        <Button onClick={() => setFormMode({ type: "create-root" })}>New category</Button>
      </div>

      {errorMessage ? (
        <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {pendingDelete ? (
        <CategoryDeleteConfirmationDialog
          category={pendingDelete}
          hasChildren={getChildren(categories, pendingDelete.id).length > 0}
          isDeleting={isDeleting}
          onOpenChange={(open) => !open && setPendingDelete(null)}
          onDelete={() => void deleteCategory(pendingDelete, "block")}
          onDeleteChildren={() => void deleteCategory(pendingDelete, "delete")}
          onPromoteChildren={() => void deleteCategory(pendingDelete, "promote")}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading categories...</p> : null}
        {!isLoading && rootCategories.length === 0 ? (
          <p className="border border-dashed p-6 text-sm text-muted-foreground">
            No categories yet. Create a root category to start organizing transactions.
          </p>
        ) : null}
        {rootCategories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            childrenCategories={getChildren(categories, category.id)}
            onAddChild={() => setFormMode({ type: "create-child", parentId: category.id })}
            onEdit={setFormMode}
            onDelete={setPendingDelete}
          />
        ))}
      </div>

      <Drawer
        open={formMode !== null}
        onOpenChange={(open) => !open && setFormMode(null)}
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
