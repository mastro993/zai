export type PageCheckboxState = "none" | "some" | "all";

export const getPageCheckboxState = (
  items: Array<{ id: string }>,
  selectedIds: ReadonlySet<string>,
): PageCheckboxState => {
  if (items.length === 0) {
    return "none";
  }

  const selectedOnPage = items.filter((item) => selectedIds.has(item.id)).length;
  if (selectedOnPage === 0) {
    return "none";
  }
  if (selectedOnPage === items.length) {
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
  items: Array<{ id: string }>,
  selectAll: boolean,
): Set<string> => {
  const next = new Set(selectedIds);
  for (const item of items) {
    if (selectAll) {
      next.add(item.id);
    } else {
      next.delete(item.id);
    }
  }
  return next;
};

export const shouldShowSelectAllMatching = (
  pageCheckboxState: PageCheckboxState,
  hasMoreMatching: boolean,
  selectAllMatching: boolean,
): boolean => pageCheckboxState === "all" && hasMoreMatching && !selectAllMatching;

export const retainAfterPartialSuccess = (
  selectedIds: ReadonlySet<string>,
  results: Array<{ recurringTransactionId: string; outcome: string }>,
): Set<string> => {
  const succeeded = new Set(
    results
      .filter((result) => result.outcome === "succeeded")
      .map((result) => result.recurringTransactionId),
  );
  return new Set([...selectedIds].filter((id) => !succeeded.has(id)));
};
