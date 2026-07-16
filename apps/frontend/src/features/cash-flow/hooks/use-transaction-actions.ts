import { Result } from "@praha/byethrow";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { exportTransactions } from "../commands/transaction-export";
import {
  createTransaction,
  deleteTransaction,
  deleteTransactions,
  getFilteredTransactionIds,
  updateTransaction,
} from "../commands/transactions";
import type { Transaction, TransactionFormValues } from "../types/model";
import type { TransactionFormMode } from "../types/transaction-types";
import type { TransactionListController } from "./use-transaction-list-controller";
import { useTransactionSelection } from "./use-transaction-selection";

export function useTransactionActions(controller: TransactionListController) {
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

  const selection = useTransactionSelection(controller.transactions);
  const { syncFilterFingerprint } = selection;

  useEffect(() => {
    syncFilterFingerprint(controller.activeFilters);
  }, [controller.activeFilters, syncFilterFingerprint]);

  const refreshList = (includeCategories = false) =>
    controller.loadData(
      controller.debouncedQuery,
      controller.page,
      controller.perPage,
      controller.dateSelection,
      controller.typeSelection,
      controller.categorySelection,
      controller.categories,
      includeCategories,
    );

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
    await refreshList();
    toast.success(editingId ? "Transaction updated" : "Transaction created");
  };

  const exportTransactionCsv = async () => {
    setIsExporting(true);
    const isSelectedExport = selection.selectedCount > 0;

    const result = isSelectedExport
      ? await exportTransactions({ transactionIds: [...selection.selectedIds] })
      : await exportTransactions({ filters: controller.activeFilters });

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
      controller.setErrorMessage(result.error.message);
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      return;
    }

    selection.removeFromSelection(transaction.id);
    setIsDeleteDialogOpen(false);
    await refreshList();
    setIsDeleting(false);
  };

  const selectAllMatchingTransactions = async () => {
    setIsSelectingAllMatching(true);
    const idsResult = await getFilteredTransactionIds(controller.activeFilters);

    if (Result.isFailure(idsResult)) {
      toast.error("Failed to select matching transactions", {
        description: idsResult.error.message,
      });
      setIsSelectingAllMatching(false);
      return;
    }

    selection.applySelectAllMatching(idsResult.value, controller.activeFilters);
    setIsSelectingAllMatching(false);
  };

  const removeSelectedTransactions = async () => {
    const transactionIds = [...selection.selectedIds];

    if (transactionIds.length === 0) {
      return;
    }

    setIsBulkDeleting(true);
    const result = await deleteTransactions(transactionIds);

    if (Result.isFailure(result)) {
      controller.setErrorMessage(result.error.message);
      setIsBulkDeleteDialogOpen(false);
      setIsBulkDeleting(false);
      return;
    }

    const deletedCount = result.value.length;
    selection.clearSelection();
    setIsBulkDeleteDialogOpen(false);
    await refreshList();
    setIsBulkDeleting(false);
    toast.success(
      deletedCount === 1 ? "Deleted 1 transaction" : `Deleted ${deletedCount} transactions`,
    );
  };

  return {
    ...selection,
    exportTransactionCsv,
    formMode,
    isBulkDeleteDialogOpen,
    isBulkDeleting,
    isDeleteDialogOpen,
    isDeleting,
    isExporting,
    isFormDrawerOpen,
    isImportDialogOpen,
    isSelectingAllMatching,
    openDeleteDialog,
    openFormDrawer,
    pendingDelete,
    refreshList,
    removeSelectedTransactions,
    removeTransaction,
    selectAllMatchingTransactions,
    setFormMode,
    setIsBulkDeleteDialogOpen,
    setIsDeleteDialogOpen,
    setIsFormDrawerOpen,
    setIsImportDialogOpen,
    setPendingDelete,
    submitTransaction,
  };
}
