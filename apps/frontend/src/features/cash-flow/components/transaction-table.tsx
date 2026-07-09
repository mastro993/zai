import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrencyFromMinor } from "@/lib/currency";

import { getCategoryDisplayColor, getCategoryDisplayName } from "../lib/category";
import {
  computeFilteredTotalCount,
  shouldShowSelectAllMatching,
  type PageCheckboxState,
} from "../lib/transaction-selection";
import { toDateTimeInputValue } from "../lib/transaction";
import type { Transaction, TransactionCategory } from "../types/model";
import type { TransactionFormMode } from "../types/transaction-types";
import { CategoryBadge } from "./category-badge";
import { TransactionTypeBadge } from "./transaction-type-badge";

type TransactionTableProps = {
  transactions: Array<Transaction>;
  categoryById: Map<string, TransactionCategory>;
  selectedIds: ReadonlySet<string>;
  pageCheckboxState: PageCheckboxState;
  selectAllMatching: boolean;
  page: number;
  perPage: number;
  totalPages: number;
  onToggleRow: (transaction: Transaction, selected: boolean, shiftKey: boolean) => void;
  onTogglePage: (selectAll: boolean) => void;
  onSelectAllMatching: () => void;
  onEdit: (mode: TransactionFormMode) => void;
  onDelete: (transaction: Transaction) => void;
};

function HeaderCheckbox({
  pageCheckboxState,
  onTogglePage,
}: {
  pageCheckboxState: PageCheckboxState;
  onTogglePage: (selectAll: boolean) => void;
}) {
  return (
    <Checkbox
      aria-label="Select all transactions on this page"
      checked={pageCheckboxState === "all"}
      data-indeterminate={pageCheckboxState === "some" ? true : undefined}
      onCheckedChange={(checked) => {
        onTogglePage(checked === true);
      }}
    />
  );
}

function TransactionTable({
  transactions,
  categoryById,
  selectedIds,
  pageCheckboxState,
  selectAllMatching,
  page,
  perPage,
  totalPages,
  onToggleRow,
  onTogglePage,
  onSelectAllMatching,
  onEdit,
  onDelete,
}: TransactionTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const filteredTotalCount = computeFilteredTotalCount(
    page,
    perPage,
    totalPages,
    transactions.length,
  );
  const showSelectAllMatching = shouldShowSelectAllMatching(
    pageCheckboxState,
    totalPages,
    selectAllMatching,
  );

  const handleTableKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const isSelectAllShortcut =
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "a" &&
      transactions.length > 0;

    if (!isSelectAllShortcut) {
      return;
    }

    event.preventDefault();
    onTogglePage(true);
  };

  return (
    <div
      ref={tableRef}
      tabIndex={0}
      className="outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
      onKeyDown={handleTableKeyDown}
    >
      {showSelectAllMatching ? (
        <div className="border border-b-0 bg-muted/20 px-3 py-2 text-xs">
          <span className="text-muted-foreground">All transactions on this page are selected.</span>{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-4 hover:underline"
            onClick={onSelectAllMatching}
          >
            {filteredTotalCount === null
              ? "Select all matching transactions"
              : `Select all ${filteredTotalCount} matching transactions`}
          </button>
        </div>
      ) : null}

      <Table className="border text-sm">
        <TableHeader className="bg-muted/40 text-left">
          <TableRow>
            <TableHead className="w-px p-3">
              <HeaderCheckbox pageCheckboxState={pageCheckboxState} onTogglePage={onTogglePage} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap p-3 font-medium">Date</TableHead>
            <TableHead className="w-px whitespace-nowrap p-3 font-medium">Type</TableHead>
            <TableHead className="w-px whitespace-nowrap p-3 font-medium">Category</TableHead>
            <TableHead className="w-px whitespace-nowrap p-3 text-right font-medium">
              Amount
            </TableHead>
            <TableHead className="p-3 font-medium">Description</TableHead>
            <TableHead className="sticky right-0 z-10 whitespace-nowrap bg-muted/40 p-3 text-right font-medium">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const category = transaction.transactionCategoryId
              ? categoryById.get(transaction.transactionCategoryId)
              : undefined;
            const isSelected = selectedIds.has(transaction.id);

            return (
              <TableRow
                key={transaction.id}
                data-state={isSelected ? "selected" : undefined}
                className={cn("border-t", isSelected && "bg-muted/30", "cursor-pointer")}
                onClick={(event) => {
                  const target = event.target as HTMLElement;

                  if (target.closest("button, [data-slot='checkbox'], a")) {
                    return;
                  }

                  onToggleRow(transaction, !isSelected, event.shiftKey);
                }}
              >
                <TableCell className="w-px p-3">
                  <Checkbox
                    aria-label={`Select transaction ${transaction.description || transaction.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      onToggleRow(transaction, checked === true, false);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap p-3">
                  {toDateTimeInputValue(transaction.transactionDate)}
                </TableCell>
                <TableCell className="whitespace-nowrap p-3">
                  <TransactionTypeBadge type={transaction.transactionType} />
                </TableCell>
                <TableCell className="whitespace-nowrap p-3">
                  {category ? (
                    <CategoryBadge color={getCategoryDisplayColor(category)}>
                      {getCategoryDisplayName(category, categoryById)}
                    </CategoryBadge>
                  ) : (
                    <span className="text-muted-foreground">Uncategorized</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap p-3 text-right tabular-nums">
                  {formatCurrencyFromMinor(transaction.amount, "EUR")}
                </TableCell>
                <TableCell className="max-w-0 p-3">
                  <span className="block truncate">
                    {transaction.description || "No description"}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "sticky right-0 z-10 p-3",
                    isSelected ? "bg-muted/30" : "bg-background",
                  )}
                >
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit({ type: "edit", transaction });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(transaction);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export { TransactionTable };
