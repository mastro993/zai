import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { togglePageInSelection, toggleRowInSelection } from "../lib/recurring-selection";

interface SelectableRecurring {
  id: string;
  revision: number;
}

type RecurringSelectionApi = {
  selectedIds: Set<string>;
  revisionsById: Map<string, number>;
  selectedCount: number;
  selectAllMatching: boolean;
  clearSelection: () => void;
  toggleRow: (item: SelectableRecurring, selected: boolean) => void;
  togglePage: (items: Array<SelectableRecurring>, selectAll: boolean) => void;
  applySelectAllMatching: (items: Array<SelectableRecurring>) => void;
  setSelectedIds: (ids: Set<string>) => void;
  rememberRevisions: (items: Array<SelectableRecurring>) => void;
};

const RecurringSelectionContext = createContext<RecurringSelectionApi | null>(null);

export function RecurringSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [revisionsById, setRevisionsById] = useState<Map<string, number>>(() => new Map());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const rememberRevisions = useCallback((items: Array<SelectableRecurring>) => {
    setRevisionsById((current) => {
      const next = new Map(current);
      for (const item of items) {
        next.set(item.id, item.revision);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }, []);

  const toggleRow = useCallback(
    (item: SelectableRecurring, selected: boolean) => {
      setSelectAllMatching(false);
      setSelectedIds((current) => toggleRowInSelection(current, item.id, selected));
      rememberRevisions([item]);
    },
    [rememberRevisions],
  );

  const togglePage = useCallback(
    (items: Array<SelectableRecurring>, selectAll: boolean) => {
      setSelectAllMatching(false);
      setSelectedIds((current) => togglePageInSelection(current, items, selectAll));
      rememberRevisions(items);
    },
    [rememberRevisions],
  );

  const applySelectAllMatching = useCallback(
    (items: Array<SelectableRecurring>) => {
      setSelectedIds(new Set(items.map((item) => item.id)));
      setSelectAllMatching(true);
      rememberRevisions(items);
    },
    [rememberRevisions],
  );

  const value = useMemo(
    () => ({
      selectedIds,
      revisionsById,
      selectedCount: selectedIds.size,
      selectAllMatching,
      clearSelection,
      toggleRow,
      togglePage,
      applySelectAllMatching,
      setSelectedIds,
      rememberRevisions,
    }),
    [
      selectedIds,
      revisionsById,
      selectAllMatching,
      clearSelection,
      toggleRow,
      togglePage,
      applySelectAllMatching,
      rememberRevisions,
    ],
  );

  return (
    <RecurringSelectionContext.Provider value={value}>
      {children}
    </RecurringSelectionContext.Provider>
  );
}

export function useRecurringSelectionContext(): RecurringSelectionApi {
  const contextValue = useContext(RecurringSelectionContext);
  if (!contextValue) {
    throw new Error("useRecurringSelectionContext requires RecurringSelectionProvider");
  }
  return contextValue;
}
