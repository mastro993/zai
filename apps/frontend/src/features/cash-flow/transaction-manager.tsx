import { R } from "@praha/byethrow";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { getTransactionCategories } from "@/commands/transaction-categories";
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "@/commands/transactions";

import { TransactionDeleteConfirmationDialog } from "./transaction-delete-confirmation-dialog";
import { TransactionFormDrawer } from "./transaction-form-drawer";
import { TransactionTable } from "./transaction-table";
import type { TransactionFormMode } from "./transaction-types";
import type { Transaction, TransactionCategory, TransactionFormValues } from "./model";

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
        <TransactionTable
          transactions={transactions}
          categoryById={categoryById}
          onEdit={setFormMode}
          onDelete={setPendingDelete}
        />
      ) : null}

      <TransactionDeleteConfirmationDialog
        transaction={pendingDelete}
        isDeleting={isDeleting}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onDelete={() => {
          if (pendingDelete) {
            void removeTransaction(pendingDelete);
          }
        }}
      />

      <Drawer
        open={formMode !== null}
        onOpenChange={(open) => !open && setFormMode(null)}
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
