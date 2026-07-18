export const TRANSACTION_ROWS_PER_PAGE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_TRANSACTION_ROWS_PER_PAGE = 50;

type TransactionRowsPerPage = (typeof TRANSACTION_ROWS_PER_PAGE_OPTIONS)[number];

type PaginationToken = number | "ellipsis";

export type { TransactionRowsPerPage };

export const createPaginationRange = (
  currentPage: number,
  totalPages: number,
): Array<PaginationToken> => {
  if (totalPages <= 1) {
    return [1];
  }

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const range: Array<PaginationToken> = [1];

  if (currentPage > 3) {
    range.push("ellipsis");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    range.push(page);
  }

  if (currentPage < totalPages - 2) {
    range.push("ellipsis");
  }

  range.push(totalPages);

  return range;
};
