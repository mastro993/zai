import type { ComponentProps } from "react";

import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const tableRowActionsRevealClassName =
  "opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 motion-reduce:transition-none";

function TransactionTableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <TableRow data-slot="transaction-table-row" className={cn("group/row", className)} {...props} />
  );
}

function TransactionTableRowActions({
  className,
  children,
  ...props
}: ComponentProps<typeof TableCell>) {
  return (
    <TableCell
      data-slot="transaction-table-row-actions"
      className={cn("w-px p-3", className)}
      {...props}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-end gap-1",
          tableRowActionsRevealClassName,
        )}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
      >
        {children}
      </div>
    </TableCell>
  );
}

function TransactionTableHeadActions({ className, ...props }: ComponentProps<typeof TableHead>) {
  return (
    <TableHead
      data-slot="transaction-table-head-actions"
      aria-hidden="true"
      className={cn("w-px p-3", className)}
      {...props}
    />
  );
}

export { TransactionTableHeadActions, TransactionTableRow, TransactionTableRowActions };
