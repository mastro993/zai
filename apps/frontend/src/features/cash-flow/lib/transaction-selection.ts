import type { TransactionFilters } from "../commands/transactions";

export type PageCheckboxState = "none" | "some" | "all";

export const getPageCheckboxState = (
  transactions: Array<{ id: string }>,
  selectedIds: ReadonlySet<string>,
): PageCheckboxState => {
  if (transactions.length === 0) {
    return "none";
  }

  const selectedOnPage = transactions.filter((transaction) =>
    selectedIds.has(transaction.id),
  ).length;

  if (selectedOnPage === 0) {
    return "none";
  }

  if (selectedOnPage === transactions.length) {
    return "all";
  }

  return "some";
};

export const toggleRowInSelection = (
  selectedIds: ReadonlySet<string>,
  id: string,
  selected: boolean,
): Set<string> => {
  const next = new Set(selectedIds);

  if (selected) {
    next.add(id);
  } else {
    next.delete(id);
  }

  return next;
};

export const togglePageInSelection = (
  selectedIds: ReadonlySet<string>,
  transactions: Array<{ id: string }>,
  selectAll: boolean,
): Set<string> => {
  const next = new Set(selectedIds);

  for (const transaction of transactions) {
    if (selectAll) {
      next.add(transaction.id);
    } else {
      next.delete(transaction.id);
    }
  }

  return next;
};

export const selectRangeOnPage = (
  selectedIds: ReadonlySet<string>,
  transactions: Array<{ id: string }>,
  anchorId: string,
  targetId: string,
): Set<string> => {
  const anchorIndex = transactions.findIndex((transaction) => transaction.id === anchorId);
  const targetIndex = transactions.findIndex((transaction) => transaction.id === targetId);

  if (anchorIndex === -1 || targetIndex === -1) {
    return new Set(selectedIds);
  }

  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  const next = new Set(selectedIds);

  for (let index = start; index <= end; index += 1) {
    next.add(transactions[index].id);
  }

  return next;
};

export const serializeTransactionFilters = (filters: TransactionFilters | undefined): string =>
  JSON.stringify(filters ?? {});

export const computeFilteredTotalCount = (
  page: number,
  perPage: number,
  totalPages: number,
  visibleCount: number,
): number | null => {
  if (visibleCount === 0 && totalPages <= 1) {
    return 0;
  }

  if (page === totalPages) {
    return (totalPages - 1) * perPage + visibleCount;
  }

  return null;
};

export const shouldShowSelectAllMatching = (
  pageCheckboxState: PageCheckboxState,
  totalPages: number,
  selectAllMatching: boolean,
): boolean => pageCheckboxState === "all" && totalPages > 1 && !selectAllMatching;

export const idsFromTransactions = (transactions: Array<{ id: string }>): Set<string> =>
  new Set(transactions.map((transaction) => transaction.id));
