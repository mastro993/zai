import { R } from "@praha/byethrow";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

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
import { getTransactionCategories } from "@/commands/transaction-categories";
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "@/commands/transactions";

import {
  TRANSACTION_TYPES,
  type Transaction,
  type TransactionCategory,
  type TransactionFormInput,
  type TransactionFormValues,
  type TransactionType,
  getCategoryDisplayColor,
  toDateTimeInputValue,
  transactionFormSchema,
} from "./model";

type TransactionFormMode = { type: "create" } | { type: "edit"; transaction: Transaction };

const getLocalDateTimeInputValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const getFormDefaults = (mode: TransactionFormMode): TransactionFormValues => {
  if (mode.type === "create") {
    return {
      description: "",
      amount: 1,
      transactionDate: getLocalDateTimeInputValue(),
      transactionType: "expense",
      transactionCategoryId: "",
      notes: "",
    };
  }

  return {
    description: mode.transaction.description ?? "",
    amount: mode.transaction.amount,
    transactionDate: toDateTimeInputValue(mode.transaction.transactionDate),
    transactionType: mode.transaction.transactionType as TransactionType,
    transactionCategoryId: mode.transaction.transactionCategoryId ?? "",
    notes: mode.transaction.notes ?? "",
  };
};

export function TransactionManager() {
  const [transactions, setTransactions] = useState<Array<Transaction>>([]);
  const [categories, setCategories] = useState<Array<TransactionCategory>>([]);
  const [formMode, setFormMode] = useState<TransactionFormMode | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories],
  );

  const loadData = async () => {
    setIsLoading(true);
    const [transactionsResult, categoriesResult] = await Promise.all([
      getTransactions(),
      getTransactionCategories(),
    ]);

    if (R.isFailure(transactionsResult)) {
      setErrorMessage(transactionsResult.error.message);
    } else {
      setTransactions(transactionsResult.value.data);
    }

    if (R.isFailure(categoriesResult)) {
      setErrorMessage(categoriesResult.error.message);
    } else {
      setCategories(categoriesResult.value);
    }

    if (R.isSuccess(transactionsResult) && R.isSuccess(categoriesResult)) {
      setErrorMessage(null);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const submitTransaction = async (values: TransactionFormValues) => {
    const result =
      formMode?.type === "edit"
        ? await updateTransaction(formMode.transaction.id, values)
        : await createTransaction(values);

    if (R.isFailure(result)) {
      setErrorMessage(result.error.message);
      return;
    }

    setFormMode(null);
    await loadData();
  };

  const removeTransaction = async (transaction: Transaction) => {
    setIsDeleting(true);
    const result = await deleteTransaction(transaction.id);

    if (R.isFailure(result)) {
      setErrorMessage(result.error.message);
      setPendingDelete(null);
      setIsDeleting(false);
      return;
    }

    setPendingDelete(null);
    await loadData();
    setIsDeleting(false);
  };

  return (
    <section className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Log income and expenses with an optional category.
          </p>
        </div>
        <Button onClick={() => setFormMode({ type: "create" })}>New transaction</Button>
      </div>

      {errorMessage ? (
        <div className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading transactions...</p> : null}

      {!isLoading && transactions.length === 0 ? (
        <p className="border border-dashed p-6 text-sm text-muted-foreground">
          No transactions yet. Add income or an expense to start tracking cash flow.
        </p>
      ) : null}

      {transactions.length > 0 ? (
        <div className="overflow-x-auto border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Description</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 text-right font-medium">Amount</th>
                <th className="p-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const category = transaction.transactionCategoryId
                  ? categoryById.get(transaction.transactionCategoryId)
                  : undefined;

                return (
                  <tr key={transaction.id} className="border-t">
                    <td className="p-3">{toDateTimeInputValue(transaction.transactionDate)}</td>
                    <td className="p-3">{transaction.description || "No description"}</td>
                    <td className="p-3 capitalize">{transaction.transactionType}</td>
                    <td className="p-3">
                      {category ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-3 border"
                            style={{
                              backgroundColor: getCategoryDisplayColor(category),
                            }}
                            aria-hidden="true"
                          />
                          {category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Uncategorized</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums">{transaction.amount}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFormMode({ type: "edit", transaction })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setPendingDelete(transaction)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmationDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete transaction?"
        description={
          pendingDelete?.description
            ? `This will permanently delete "${pendingDelete.description}".`
            : "This will permanently delete this transaction."
        }
        isActionPending={isDeleting}
      >
        <Button
          variant="destructive"
          size="sm"
          disabled={isDeleting}
          onClick={() => {
            if (pendingDelete) {
              void removeTransaction(pendingDelete);
            }
          }}
        >
          {isDeleting ? "Deleting..." : "Delete transaction"}
        </Button>
      </ConfirmationDialog>

      <Sheet open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        {formMode ? (
          <TransactionFormSheet
            key={formMode.type === "edit" ? formMode.transaction.id : "create"}
            mode={formMode}
            categories={categories}
            onSubmit={submitTransaction}
          />
        ) : null}
      </Sheet>
    </section>
  );
}

function TransactionFormSheet({
  mode,
  categories,
  onSubmit,
}: {
  mode: TransactionFormMode;
  categories: Array<TransactionCategory>;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
}) {
  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: getFormDefaults(mode),
  });
  const title = mode.type === "edit" ? "Edit transaction" : "New transaction";
  const rootCategories = categories.filter((category) => !category.parentId);
  const childCategories = categories.filter((category) => category.parentId);

  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>
          Select a category when useful, or leave the transaction uncategorized.
        </SheetDescription>
      </SheetHeader>
      <form
        className="flex flex-1 flex-col gap-4 p-4"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Description
          <Input {...form.register("description")} />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Amount
          <Input
            type="number"
            min={1}
            step={1}
            aria-invalid={Boolean(form.formState.errors.amount)}
            {...form.register("amount", { valueAsNumber: true })}
          />
          {form.formState.errors.amount?.message ? (
            <span className="text-xs text-destructive">{form.formState.errors.amount.message}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Date
          <Input
            type="datetime-local"
            aria-invalid={Boolean(form.formState.errors.transactionDate)}
            {...form.register("transactionDate")}
          />
          {form.formState.errors.transactionDate?.message ? (
            <span className="text-xs text-destructive">
              {form.formState.errors.transactionDate.message}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Type
          <select
            className="h-8 border border-input bg-background px-2.5 text-xs capitalize outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            {...form.register("transactionType")}
          >
            {TRANSACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Category
          <select
            className="h-8 border border-input bg-background px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            {...form.register("transactionCategoryId")}
          >
            <option value="">Uncategorized</option>
            {rootCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            {childCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.parent?.name ?? "Root"} / {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Notes
          <Input {...form.register("notes")} />
        </label>

        <SheetFooter className="p-0">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save transaction
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}
