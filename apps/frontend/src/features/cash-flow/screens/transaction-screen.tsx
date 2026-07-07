import { R } from "@praha/byethrow";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

import { getTransactionCategories } from "../commands/transaction-categories";
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "../commands/transactions";
import { TransactionDeleteConfirmationDialog } from "../components/transaction-delete-confirmation-dialog";
import { TransactionFormDrawer } from "../components/transaction-form-drawer";
import { TransactionImportDialog } from "../components/transaction-import-dialog";
import { TransactionTable } from "../components/transaction-table";
import type { Transaction, TransactionCategory, TransactionFormValues } from "../types/model";
import type { TransactionFormMode } from "../types/transaction-types";

export function TransactionScreen() {
  const [transactions, setTransactions] = useState<Array<Transaction>>([]);
  const [categories, setCategories] = useState<Array<TransactionCategory>>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [formMode, setFormMode] = useState<TransactionFormMode | null>(null);
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasLoadedCategories = useRef(false);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories],
  );

  const loadData = async (searchQuery: string, includeCategories = false) => {
    setIsLoading(true);
    const transactionsResult = await getTransactions(
      1,
      50,
      searchQuery.length > 0 ? { query: searchQuery } : undefined,
    );

    if (R.isFailure(transactionsResult)) {
      setErrorMessage(transactionsResult.error.message);
    } else {
      setTransactions(transactionsResult.value.data);
      setErrorMessage(null);
    }

    if (includeCategories) {
      const categoriesResult = await getTransactionCategories();
      if (R.isFailure(categoriesResult)) {
        setErrorMessage(categoriesResult.error.message);
      } else {
        setCategories(categoriesResult.value);
        if (R.isSuccess(transactionsResult)) {
          setErrorMessage(null);
        }
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    const includeCategories = !hasLoadedCategories.current;
    hasLoadedCategories.current = true;
    void loadData(debouncedQuery, includeCategories);
  }, [debouncedQuery]);

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
    await loadData(debouncedQuery);
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
    await loadData(debouncedQuery);
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
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder="Search description or notes..."
            value={query}
            className="w-72"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            Import transactions
          </Button>
          <Button onClick={() => openFormDrawer({ type: "create" })}>New transaction</Button>
        </div>
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

      <TransactionImportDialog
        open={isImportDialogOpen}
        categories={categories}
        transactions={transactions}
        onOpenChange={setIsImportDialogOpen}
        onImported={async (createdCount, skippedRows) => {
          await loadData(debouncedQuery, true);
          toast.success(`Imported ${createdCount} transactions`, {
            description:
              skippedRows > 0 ? `${skippedRows} rows were skipped during preview.` : undefined,
          });
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
