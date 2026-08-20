import { Result } from "@praha/byethrow";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/toaster/toast";

import { CommandError } from "@/commands/errors";
import {
  adoptRecurringTransaction,
  getTransactionRecurringProvenance,
} from "@/features/recurring-transactions/commands/recurring-transactions";
import type {
  RecurringFormValues,
  TransactionRecurringProvenance,
} from "@/features/recurring-transactions/types/recurring-transaction";

import { exportTransactions } from "../commands/transaction-export";
import {
  createTransaction,
  deleteTransaction,
  deleteTransactions,
  getFilteredTransactionIds,
  getTransaction,
  type TransactionFilters,
  updateTransaction,
} from "../commands/transactions";
import { setLastUsedTransactionCurrency } from "../lib/last-used-currency";
import type { Transaction, TransactionFormValues, TransactionListItem } from "../types/model";
import type { TransactionFormMode } from "../types/transaction-types";
import { useTransactionSelection } from "./use-transaction-selection";

interface TransactionActionsController {
  activeFilters: TransactionFilters | undefined;
  refreshList: (includeCategories?: boolean) => Promise<void>;
  setErrorMessage: (message: string | null) => void;
  transactions: Array<TransactionListItem>;
}

export function useTransactionActions(controller: TransactionActionsController) {
  const [formMode, setFormMode] = useState<TransactionFormMode | null>(null);
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TransactionListItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSelectingAllMatching, setIsSelectingAllMatching] = useState(false);
  const [adoptTransaction, setAdoptTransaction] = useState<Transaction | null>(null);
  const [isAdoptDrawerOpen, setIsAdoptDrawerOpen] = useState(false);
  const [editProvenance, setEditProvenance] = useState<TransactionRecurringProvenance | null>(null);
  const [pendingManualRate, setPendingManualRate] = useState<TransactionFormValues | null>(null);
  const adoptButtonRef = useRef<HTMLButtonElement | null>(null);

  const selection = useTransactionSelection(controller.transactions);
  const { syncFilterFingerprint } = selection;

  useEffect(() => {
    syncFilterFingerprint(controller.activeFilters);
  }, [controller.activeFilters, syncFilterFingerprint]);

  const openFormDrawer = (mode: { type: "create" }) => {
    setFormMode(mode);
    setEditProvenance(null);
    setIsFormDrawerOpen(true);
  };

  const openEditForm = async (transactionId: string) => {
    const result = await getTransaction(transactionId);
    if (Result.isFailure(result)) {
      toast.error("Failed to load transaction", { description: result.error.message });
      return;
    }

    setFormMode({ type: "edit", transaction: result.value });
    setEditProvenance(null);
    setIsFormDrawerOpen(true);
    const provenance = await getTransactionRecurringProvenance(transactionId);
    if (Result.isFailure(provenance)) {
      toast.error("Could not load recurring link", {
        description: provenance.error.message,
      });
      return;
    }
    setEditProvenance(provenance.value);
  };

  const openDeleteDialog = (transaction: TransactionListItem) => {
    setPendingDelete(transaction);
    setIsDeleteDialogOpen(true);
  };

  const openAdoptDrawer = async (
    transaction: TransactionListItem,
    trigger?: HTMLButtonElement | null,
  ) => {
    adoptButtonRef.current = trigger ?? null;
    if (!transaction.description?.trim()) {
      toast.error("Add a description to this transaction before adopting it.");
      return;
    }
    const provenance = await getTransactionRecurringProvenance(transaction.id);
    if (Result.isFailure(provenance)) {
      toast.error("Could not check recurring provenance", {
        description: provenance.error.message,
      });
      return;
    }
    if (provenance.value) {
      toast.error("Transaction already belongs to a recurring schedule");
      return;
    }
    const detail = await getTransaction(transaction.id);
    if (Result.isFailure(detail)) {
      toast.error("Failed to load transaction", { description: detail.error.message });
      return;
    }
    setAdoptTransaction(detail.value);
    setIsAdoptDrawerOpen(true);
  };

  const submitAdopt = async (values: RecurringFormValues) => {
    if (!adoptTransaction) {
      return Result.fail(new CommandError("No transaction selected for adoption"));
    }
    const result = await adoptRecurringTransaction(adoptTransaction, values);
    if (Result.isSuccess(result)) {
      await controller.refreshList();
    }
    return result;
  };

  const finishWrite = async (editingId: string | null, currency: string) => {
    setLastUsedTransactionCurrency(currency);
    setPendingManualRate(null);
    setIsFormDrawerOpen(false);
    await controller.refreshList();
    toast.success(editingId ? "Transaction updated" : "Transaction created");
  };

  const submitTransaction = async (
    values: TransactionFormValues,
    confirmManualRateReplacement = false,
  ) => {
    const editingId = formMode?.type === "edit" ? formMode.transaction.id : null;
    const result = editingId
      ? await updateTransaction(editingId, values, { confirmManualRateReplacement })
      : await createTransaction(values);

    if (Result.isFailure(result)) {
      if (result.error.code === "manualRateReplacementRequired") {
        setPendingManualRate(values);
        return;
      }
      toast.error(editingId ? "Failed to update transaction" : "Failed to create transaction", {
        description: result.error.message,
      });
      return;
    }

    await finishWrite(editingId, values.currency);
  };

  const confirmManualRateReplacement = async () => {
    if (!pendingManualRate) {
      return;
    }
    await submitTransaction(pendingManualRate, true);
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

  const removeTransaction = async (transaction: TransactionListItem) => {
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
    await controller.refreshList();
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
    await controller.refreshList();
    setIsBulkDeleting(false);
    toast.success(
      deletedCount === 1 ? "Deleted 1 transaction" : `Deleted ${deletedCount} transactions`,
    );
  };

  return {
    ...selection,
    adoptButtonRef,
    adoptTransaction,
    confirmManualRateReplacement,
    editProvenance,
    exportTransactionCsv,
    formMode,
    isAdoptDrawerOpen,
    isBulkDeleteDialogOpen,
    isBulkDeleting,
    isDeleteDialogOpen,
    isDeleting,
    isExporting,
    isFormDrawerOpen,
    isImportDialogOpen,
    isSelectingAllMatching,
    openAdoptDrawer,
    openDeleteDialog,
    openEditForm,
    openFormDrawer,
    pendingDelete,
    pendingManualRate,
    refreshList: controller.refreshList,
    removeSelectedTransactions,
    removeTransaction,
    selectAllMatchingTransactions,
    setAdoptTransaction,
    setFormMode,
    setIsAdoptDrawerOpen,
    setIsBulkDeleteDialogOpen,
    setIsDeleteDialogOpen,
    setIsFormDrawerOpen,
    setIsImportDialogOpen,
    setPendingDelete,
    setPendingManualRate,
    submitAdopt,
    submitTransaction,
  };
}
