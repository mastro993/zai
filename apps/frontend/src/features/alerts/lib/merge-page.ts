import type { DomainAlert, DomainAlertListPage } from "../types/domain-alert";
import { matchesAlertFilters } from "./matches-alert-filters";
import type { AlertSessionFilters } from "./session-filters";

const isAfter = (left: DomainAlert, right: DomainAlert): boolean => {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt > right.createdAt;
  }
  return left.id > right.id;
};

export const mergeReconciledAlertPage = (
  currentItems: Array<DomainAlert>,
  page: DomainAlertListPage,
  filters: AlertSessionFilters,
): Array<DomainAlert> => {
  const itemsById = new Map(currentItems.map((item) => [item.id, item]));
  for (const item of page.items) {
    itemsById.set(item.id, item);
  }

  return [...itemsById.values()]
    .filter((item) => matchesAlertFilters(item, filters))
    .toSorted((left, right) => {
      if (isAfter(left, right)) {
        return -1;
      }
      return isAfter(right, left) ? 1 : 0;
    });
};
