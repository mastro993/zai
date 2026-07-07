import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createPaginationRange,
  TRANSACTION_ROWS_PER_PAGE_OPTIONS,
  type TransactionRowsPerPage,
} from "../lib/pagination";

const rowsPerPageItems = TRANSACTION_ROWS_PER_PAGE_OPTIONS.map((value) => ({
  value: String(value),
  label: String(value),
}));

type TransactionPaginationProps = {
  page: number;
  perPage: TransactionRowsPerPage;
  totalPages: number;
  visibleCount: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: TransactionRowsPerPage) => void;
};

function TransactionPagination({
  page,
  perPage,
  totalPages,
  visibleCount,
  onPageChange,
  onPerPageChange,
}: TransactionPaginationProps) {
  const rangeStart = visibleCount === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = visibleCount === 0 ? 0 : (page - 1) * perPage + visibleCount;
  const pageTokens = createPaginationRange(page, totalPages);

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }

    onPageChange(nextPage);
  };

  return (
    <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground">
          {visibleCount === 0
            ? "No transactions on this page"
            : `Showing ${rangeStart}–${rangeEnd}`}
          {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : null}
        </p>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows per page</span>
          <Select
            items={rowsPerPageItems}
            value={String(perPage)}
            onValueChange={(next) => {
              onPerPageChange(Number(next) as TransactionRowsPerPage);
            }}
          >
            <SelectTrigger size="sm" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {rowsPerPageItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {totalPages > 1 ? (
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                tabIndex={page <= 1 ? -1 : undefined}
                aria-disabled={page <= 1}
                className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  goToPage(page - 1);
                }}
              />
            </PaginationItem>

            {pageTokens.map((token, index) =>
              token === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={token}>
                  <PaginationLink
                    href="#"
                    isActive={token === page}
                    onClick={(event) => {
                      event.preventDefault();
                      goToPage(token);
                    }}
                  >
                    {token}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                tabIndex={page >= totalPages ? -1 : undefined}
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  goToPage(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}

export { TransactionPagination };
