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
  frozenFilterFingerprint?: string;
  clearSelection: () => void;
  toggleRow: (item: SelectableRecurring, selected: boolean) => void;
  togglePage: (items: Array<SelectableRecurring>, selectAll: boolean) => void;
  applySelectAllMatching: (items: Array<SelectableRecurring>, fingerprint: string) => void;
  setSelectedIds: (ids: Set<string>) => void;
};

const RecurringSelectionContext = createContext<RecurringSelectionApi | null>(null);

export function RecurringSelectionProvider({ children }: { children: ReactNode }) {
  const [revisionsById, setRevisionsById] = useState<Map<string, number>>(() => new Map());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [frozenFilterFingerprint, setFrozenFilterFingerprint] = useState<string>();

  const selectedIds = useMemo(() => new Set(revisionsById.keys()), [revisionsById]);

  const clearSelection = useCallback(() => {
    setRevisionsById(new Map());
    setSelectAllMatching(false);
    setFrozenFilterFingerprint(undefined);
  }, []);

  const toggleRow = useCallback((item: SelectableRecurring, selected: boolean) => {
    setSelectAllMatching(false);
    setFrozenFilterFingerprint(undefined);
    setRevisionsById((current) => {
      const nextIds = toggleRowInSelection(new Set(current.keys()), item.id, selected);
      const next = new Map<string, number>();
      for (const id of nextIds) {
        const revision = id === item.id ? item.revision : current.get(id);
        if (revision !== undefined) {
          next.set(id, revision);
        }
      }
      return next;
    });
  }, []);

  const togglePage = useCallback((items: Array<SelectableRecurring>, selectAll: boolean) => {
    setSelectAllMatching(false);
    setFrozenFilterFingerprint(undefined);
    setRevisionsById((current) => {
      const nextIds = togglePageInSelection(new Set(current.keys()), items, selectAll);
      const next = new Map<string, number>();
      for (const id of nextIds) {
        const item = items.find((candidate) => candidate.id === id);
        const revision = item?.revision ?? current.get(id);
        if (revision !== undefined) {
          next.set(id, revision);
        }
      }
      return next;
    });
  }, []);

  const applySelectAllMatching = useCallback(
    (items: Array<SelectableRecurring>, fingerprint: string) => {
      setRevisionsById((current) => {
        const next = new Map(current);
        for (const item of items) {
          next.set(item.id, item.revision);
        }
        return next;
      });
      setSelectAllMatching(true);
      setFrozenFilterFingerprint(fingerprint);
    },
    [],
  );

  const setSelectedIds = useCallback((ids: Set<string>) => {
    setRevisionsById((current) => {
      const next = new Map<string, number>();
      for (const [id, revision] of current) {
        if (ids.has(id)) {
          next.set(id, revision);
        }
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      selectedIds,
      revisionsById,
      selectedCount: selectedIds.size,
      selectAllMatching,
      frozenFilterFingerprint,
      clearSelection,
      toggleRow,
      togglePage,
      applySelectAllMatching,
      setSelectedIds,
    }),
    [
      selectedIds,
      revisionsById,
      selectAllMatching,
      frozenFilterFingerprint,
      clearSelection,
      toggleRow,
      togglePage,
      applySelectAllMatching,
      setSelectedIds,
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
