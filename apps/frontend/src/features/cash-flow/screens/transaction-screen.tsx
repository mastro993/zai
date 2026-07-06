import { R } from "@praha/byethrow";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";

import { getTransactionCategories } from "../commands/transaction-categories";
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "../commands/transactions";
import { TransactionDeleteConfirmationDialog } from "../components/transaction-delete-confirmation-dialog";
import { TransactionFormDrawer } from "../components/transaction-form-drawer";
import { TransactionTable } from "../components/transaction-table";
import type { Transaction, TransactionCategory, TransactionFormValues } from "../types/model";
import type { TransactionFormMode } from "../types/transaction-types";

export function TransactionScreen() {
  const [transactions, setTransactions] = useState<Array<Transaction>>([]);
  const [categories, setCategories] = useState<Array<TransactionCategory>>([]);
  const [formMode, setFormMode] = useState<TransactionFormMode | null>(null);
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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

  const openFormDrawer = (mode: TransactionFormMode) => {
    setFormMode(mode);
    setIsFormDrawerOpen(true);
  };

  const openDeleteDialog = (transaction: Transaction) => {
    setPendingDelete(transaction);
    setIsDeleteDialogOpen(true);
  };

  const submitTransaction = async (values: TransactionFormValues) => {
    const result =
      formMode?.type === "edit"
        ? await updateTransaction(formMode.transaction.id, values)
        : await createTransaction(values);

    if (R.isFailure(result)) {
      setErrorMessage(result.error.message);
      return;
    }

    setIsFormDrawerOpen(false);
    await loadData();
  };

  const removeTransaction = async (transaction: Transaction) => {
    setIsDeleting(true);
    const result = await deleteTransaction(transaction.id);

    if (R.isFailure(result)) {
      setErrorMessage(result.error.message);
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      return;
    }

    setIsDeleteDialogOpen(false);
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
        <Button onClick={() => openFormDrawer({ type: "create" })}>New transaction</Button>
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
        <TransactionTable
          transactions={transactions}
          categoryById={categoryById}
          onEdit={openFormDrawer}
          onDelete={openDeleteDialog}
        />
      ) : null}

      <TransactionDeleteConfirmationDialog
        transaction={pendingDelete}
        open={isDeleteDialogOpen}
        isDeleting={isDeleting}
        onOpenChange={setIsDeleteDialogOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        onDelete={() => {
          if (pendingDelete) {
            void removeTransaction(pendingDelete);
          }
        }}
      />

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
          <TransactionFormDrawer
            key={formMode.type === "edit" ? formMode.transaction.id : "create"}
            mode={formMode}
            categories={categories}
            onSubmit={submitTransaction}
          />
        ) : null}
      </Drawer>
    </section>
  );
}
