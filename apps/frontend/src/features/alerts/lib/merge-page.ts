import type { DomainAlert, DomainAlertListPage } from "../types/domain-alert";

const isAfter = (left: DomainAlert, right: DomainAlert): boolean => {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt > right.createdAt;
  }
  return left.id > right.id;
};

export const mergeReconciledAlertPage = (
  currentItems: Array<DomainAlert>,
  page: DomainAlertListPage,
): Array<DomainAlert> => {
  const itemsById = new Map(currentItems.map((item) => [item.id, item]));
  for (const item of page.items) {
    itemsById.set(item.id, item);
  }

  return [...itemsById.values()].toSorted((left, right) => {
    if (isAfter(left, right)) {
      return -1;
    }
    return isAfter(right, left) ? 1 : 0;
  });
};
