import { useCallback, useState } from "react";

import type { TransactionFilters } from "../commands/transactions";
import {
  getPageCheckboxState,
  selectRangeOnPage,
  serializeTransactionFilters,
  togglePageInSelection,
  toggleRowInSelection,
  type PageCheckboxState,
} from "../lib/transaction-selection";
import type { Transaction } from "../types/model";

type UseTransactionSelectionResult = {
  selectedIds: Set<string>;
  selectedCount: number;
  selectAllMatching: boolean;
  pageCheckboxState: PageCheckboxState;
  lastAnchorId: string | null;
  clearSelection: () => void;
  syncFilterFingerprint: (filters: TransactionFilters | undefined) => void;
  toggleRow: (transaction: Transaction, selected: boolean, shiftKey: boolean) => void;
  togglePage: (transactions: Array<Transaction>, selectAll: boolean) => void;
  applySelectAllMatching: (
    transactionIds: Array<string>,
    filters: TransactionFilters | undefined,
  ) => void;
  removeFromSelection: (transactionId: string) => void;
};

export function useTransactionSelection(
  visibleTransactions: Array<Transaction>,
): UseTransactionSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [matchingFingerprint, setMatchingFingerprint] = useState<string | null>(null);
  const [lastAnchorId, setLastAnchorId] = useState<string | null>(null);

  const pageCheckboxState = getPageCheckboxState(visibleTransactions, selectedIds);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
    setMatchingFingerprint(null);
    setLastAnchorId(null);
  }, []);

  const syncFilterFingerprint = useCallback(
    (filters: TransactionFilters | undefined) => {
      const fingerprint = serializeTransactionFilters(filters);

      if (matchingFingerprint !== null && matchingFingerprint !== fingerprint) {
        setSelectAllMatching(false);
        setMatchingFingerprint(null);
      }
    },
    [matchingFingerprint],
  );

  const toggleRow = useCallback(
    (transaction: Transaction, selected: boolean, shiftKey: boolean) => {
      setSelectAllMatching(false);
      setMatchingFingerprint(null);

      setSelectedIds((current) => {
        if (shiftKey && lastAnchorId) {
          return selectRangeOnPage(current, visibleTransactions, lastAnchorId, transaction.id);
        }

        return toggleRowInSelection(current, transaction.id, selected);
      });

      setLastAnchorId(transaction.id);
    },
    [lastAnchorId, visibleTransactions],
  );

  const togglePage = useCallback((transactions: Array<Transaction>, selectAll: boolean) => {
    setSelectAllMatching(false);
    setMatchingFingerprint(null);
    setSelectedIds((current) => togglePageInSelection(current, transactions, selectAll));
    setLastAnchorId(null);
  }, []);

  const applySelectAllMatching = useCallback(
    (transactionIds: Array<string>, filters: TransactionFilters | undefined) => {
      const fingerprint = serializeTransactionFilters(filters);

      setSelectedIds(new Set(transactionIds));
      setSelectAllMatching(true);
      setMatchingFingerprint(fingerprint);
      setLastAnchorId(null);
    },
    [],
  );

  const removeFromSelection = useCallback((transactionId: string) => {
    setSelectedIds((current) => toggleRowInSelection(current, transactionId, false));
    setSelectAllMatching(false);
    setMatchingFingerprint(null);
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    selectAllMatching,
    pageCheckboxState,
    lastAnchorId,
    clearSelection,
    syncFilterFingerprint,
    toggleRow,
    togglePage,
    applySelectAllMatching,
    removeFromSelection,
  };
}
