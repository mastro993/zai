import { Result } from "@praha/byethrow";
import { useState } from "react";
import { toast } from "sonner";

import { exportTransactions } from "../commands/transaction-export";
import {
  createTransaction,
  deleteTransaction,
  deleteTransactions,
  getFilteredTransactionIds,
  type TransactionFilters,
  updateTransaction,
} from "../commands/transactions";
import type { Transaction, TransactionFormValues } from "../types/model";
import type { TransactionFormMode } from "../types/transaction-types";

interface UseTransactionActionsOptions {
  activeFilters: TransactionFilters | undefined;
  selectedIds: Set<string>;
  selectedCount: number;
  clearSelection: () => void;
  applySelectAllMatching: (ids: Array<string>, filters: TransactionFilters | undefined) => void;
  removeFromSelection: (id: string) => void;
  reload: (includeCategories?: boolean) => Promise<void>;
  setErrorMessage: (message: string | null) => void;
}

export function useTransactionActions({
  activeFilters,
  selectedIds,
  selectedCount,
  clearSelection,
  applySelectAllMatching,
  removeFromSelection,
  reload,
  setErrorMessage,
}: UseTransactionActionsOptions) {
  const [formMode, setFormMode] = useState<TransactionFormMode | null>(null);
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSelectingAllMatching, setIsSelectingAllMatching] = useState(false);

  const openFormDrawer = (mode: TransactionFormMode) => {
    setFormMode(mode);
    setIsFormDrawerOpen(true);
  };

  const openDeleteDialog = (transaction: Transaction) => {
    setPendingDelete(transaction);
    setIsDeleteDialogOpen(true);
  };

  const submitTransaction = async (values: TransactionFormValues) => {
    const editingId = formMode?.type === "edit" ? formMode.transaction.id : null;
    const result = editingId
      ? await updateTransaction(editingId, values)
      : await createTransaction(values);

    if (Result.isFailure(result)) {
      toast.error(editingId ? "Failed to update transaction" : "Failed to create transaction", {
        description: result.error.message,
      });
      return;
    }

    setIsFormDrawerOpen(false);
    await reload();
    toast.success(editingId ? "Transaction updated" : "Transaction created");
  };

  const exportTransactionCsv = async () => {
    setIsExporting(true);
    const isSelectedExport = selectedCount > 0;

    const result = isSelectedExport
      ? await exportTransactions({ transactionIds: [...selectedIds] })
      : await exportTransactions({ filters: activeFilters });

    if (Result.isFailure(result)) {
      toast.error(
        isSelectedExport
          ? "Failed to export selected transactions"
          : "Failed to export transactions",
        { description: result.error.message },
      );
    } else if (result.value) {
      toast.success(isSelectedExport ? "Selected transactions exported" : "Transactions exported", {
        description: result.value,
      });
    } else {
      toast.info(
        isSelectedExport ? "Selected transaction export canceled" : "Transaction export canceled",
      );
    }

    setIsExporting(false);
  };

  const removeTransaction = async (transaction: Transaction) => {
    setIsDeleting(true);
    const result = await deleteTransaction(transaction.id);

    if (Result.isFailure(result)) {
      setErrorMessage(result.error.message);
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      return;
    }

    removeFromSelection(transaction.id);
    setIsDeleteDialogOpen(false);
    await reload();
    setIsDeleting(false);
  };

  const selectAllMatchingTransactions = async () => {
    setIsSelectingAllMatching(true);

    const idsResult = await getFilteredTransactionIds(activeFilters);

    if (Result.isFailure(idsResult)) {
      toast.error("Failed to select matching transactions", {
        description: idsResult.error.message,
      });
      setIsSelectingAllMatching(false);
      return;
    }

    applySelectAllMatching(idsResult.value, activeFilters);
    setIsSelectingAllMatching(false);
  };

  const removeSelectedTransactions = async () => {
    const transactionIds = [...selectedIds];

    if (transactionIds.length === 0) {
      return;
    }

    setIsBulkDeleting(true);
    const result = await deleteTransactions(transactionIds);

    if (Result.isFailure(result)) {
      setErrorMessage(result.error.message);
      setIsBulkDeleteDialogOpen(false);
      setIsBulkDeleting(false);
      return;
    }

    const deletedCount = result.value.length;

    clearSelection();
    setIsBulkDeleteDialogOpen(false);
    await reload();
    setIsBulkDeleting(false);
    toast.success(
      deletedCount === 1 ? "Deleted 1 transaction" : `Deleted ${deletedCount} transactions`,
    );
  };

  const handleImported = async (createdCount: number, skippedRows: number) => {
    await reload(true);
    toast.success(`Imported ${createdCount} transactions`, {
      description: skippedRows > 0 ? `${skippedRows} rows were skipped during preview.` : undefined,
    });
  };

  return {
    formMode,
    setFormMode,
    isFormDrawerOpen,
    setIsFormDrawerOpen,
    pendingDelete,
    setPendingDelete,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isImportDialogOpen,
    setIsImportDialogOpen,
    isExporting,
    isDeleting,
    isBulkDeleteDialogOpen,
    setIsBulkDeleteDialogOpen,
    isBulkDeleting,
    isSelectingAllMatching,
    openFormDrawer,
    openDeleteDialog,
    submitTransaction,
    exportTransactionCsv,
    removeTransaction,
    selectAllMatchingTransactions,
    removeSelectedTransactions,
    handleImported,
  };
}
