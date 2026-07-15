export const flattenTransactionFiltersBody = (
  filters: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};

  if (!filters) {
    return body;
  }

  if (filters.query && typeof filters.query === "string") {
    body.query = filters.query;
  }
  if (filters.transactionType && typeof filters.transactionType === "string") {
    body.transactionType = filters.transactionType;
  }
  if (filters.startDate && typeof filters.startDate === "string") {
    body.startDate = filters.startDate;
  }
  if (filters.endDate && typeof filters.endDate === "string") {
    body.endDate = filters.endDate;
  }
  if (Array.isArray(filters.categories)) {
    if (filters.categories.length === 0) {
      body.uncategorized = "true";
    } else {
      body.categories = filters.categories.filter((categoryId) => typeof categoryId === "string");
    }
  }

  return body;
};
