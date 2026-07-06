import { R } from "@praha/byethrow";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createTransactionCategory,
  deleteTransactionCategories,
  getTransactionCategories,
  updateTransactionCategory,
} from "@/commands/transaction-categories";
import { cn } from "@/lib/utils";

import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  type CategoryChildrenDeleteStrategy,
  type CategoryFormValues,
  type TransactionCategory,
  categoryFormSchema,
  getCategoryDisplayColor,
  isCategoryColor,
} from "./model";

type CategoryFormMode =
  | { type: "create-root" }
  | { type: "create-child"; parentId: string }
  | { type: "edit"; category: TransactionCategory };

const getChildren = (categories: Array<TransactionCategory>, parentId: string) =>
  categories.filter((category) => category.parentId === parentId);

const getFormDefaults = (mode: CategoryFormMode): CategoryFormValues => {
  if (mode.type === "create-root") {
    return {
      name: "",
      parentId: "",
      description: "",
      color: CATEGORY_COLORS[0],
    };
  }

  if (mode.type === "create-child") {
    return {
      name: "",
      parentId: mode.parentId,
      description: "",
      color: undefined,
    };
  }

  return {
    name: mode.category.name,
    parentId: mode.category.parentId ?? "",
    description: mode.category.description ?? "",
    color:
      mode.category.color && isCategoryColor(mode.category.color)
        ? mode.category.color
        : CATEGORY_COLORS[0],
  };
};

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

      <Sheet open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        {formMode ? (
          <CategoryFormSheet
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
      </Sheet>
    </section>
  );
}

function CategoryCard({
  category,
  childrenCategories,
  onAddChild,
  onEdit,
  onDelete,
}: {
  category: TransactionCategory;
  childrenCategories: Array<TransactionCategory>;
  onAddChild: () => void;
  onEdit: (mode: CategoryFormMode) => void;
  onDelete: (category: TransactionCategory) => void;
}) {
  return (
    <article className="flex flex-col gap-3 border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ColorDot color={getCategoryDisplayColor(category)} />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate text-base font-medium">{category.name}</h2>
            {category.description ? (
              <p className="text-sm text-muted-foreground">{category.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAddChild}>
            Add child
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit({ type: "edit", category })}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(category)}>
            Delete
          </Button>
        </div>
      </div>

      {childrenCategories.length > 0 ? (
        <div className="ml-6 flex flex-col gap-2 border-l pl-4">
          {childrenCategories.map((child) => (
            <div key={child.id} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ColorDot color={getCategoryDisplayColor(child)} />
                <span className="truncate text-sm">{child.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit({ type: "edit", category: child })}
                >
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(child)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function CategoryDeleteConfirmationDialog({
  category,
  hasChildren,
  isDeleting,
  onOpenChange,
  onDelete,
  onDeleteChildren,
  onPromoteChildren,
}: {
  category: TransactionCategory;
  hasChildren: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onDeleteChildren: () => void;
  onPromoteChildren: () => void;
}) {
  return (
    <ConfirmationDialog
      open
      onOpenChange={onOpenChange}
      title={`Delete ${category.name}?`}
      description={
        hasChildren
          ? "This category has child categories. Choose what should happen to them."
          : "This will permanently delete this category."
      }
      isActionPending={isDeleting}
    >
      {hasChildren ? (
        <>
          <Button
            variant="destructive"
            size="sm"
            disabled={isDeleting}
            onClick={onDeleteChildren}
          >
            {isDeleting ? "Deleting..." : "Delete children"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isDeleting}
            onClick={onPromoteChildren}
          >
            Promote children
          </Button>
        </>
      ) : (
        <Button variant="destructive" size="sm" disabled={isDeleting} onClick={onDelete}>
          {isDeleting ? "Deleting..." : "Delete category"}
        </Button>
      )}
    </ConfirmationDialog>
  );
}

function CategoryFormSheet({
  mode,
  categories,
  onSubmit,
}: {
  mode: CategoryFormMode;
  categories: Array<TransactionCategory>;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
}) {
  const categoriesWithChildren = new Set(
    categories
      .filter((category) => categories.some((child) => child.parentId === category.id))
      .map((category) => category.id),
  );
  const canChooseParent = mode.type !== "edit" || !categoriesWithChildren.has(mode.category.id);
  const rootOptions = categories.filter(
    (category) => !category.parentId && (mode.type !== "edit" || category.id !== mode.category.id),
  );
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: getFormDefaults(mode),
  });
  const parentId = useWatch({
    control: form.control,
    name: "parentId",
  });
  const selectedColor =
    useWatch({
      control: form.control,
      name: "color",
    }) ?? DEFAULT_CATEGORY_COLOR;
  const isChildCategory = Boolean(parentId);
  const title = mode.type === "edit" ? "Edit category" : "New category";

  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>
          Names must be unique among categories at the same level.
        </SheetDescription>
      </SheetHeader>
      <form
        className="flex flex-1 flex-col gap-4 p-4"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <Input aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />
          {form.formState.errors.name?.message ? (
            <span className="text-xs text-destructive">{form.formState.errors.name.message}</span>
          ) : null}
        </label>

        {canChooseParent ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Parent category
            <select
              className="h-8 border border-input bg-background px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              {...form.register("parentId")}
            >
              <option value="">None</option>
              {rootOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-sm font-medium">
          Description
          <Input {...form.register("description")} />
        </label>

        {!isChildCategory ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Color</span>
            <input type="hidden" {...form.register("color")} />
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Select ${color}`}
                  className={cn(
                    "size-7 border",
                    selectedColor === color ? "ring-2 ring-ring" : null,
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() =>
                    form.setValue("color", color, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              ))}
            </div>
          </div>
        ) : null}

        <SheetFooter className="p-0">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save category
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="size-3 shrink-0 border"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}
