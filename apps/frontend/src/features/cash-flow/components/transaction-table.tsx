import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyFromMinor } from "@/lib/currency";

import {
  getCategoryDisplayColor,
  getCategoryDisplayName,
} from "../lib/category";
import { toDateTimeInputValue } from "../lib/transaction";
import type { Transaction, TransactionCategory } from "../types/model";
import type { TransactionFormMode } from "../types/transaction-types";
import { ColorDot } from "./color-dot";

function TransactionTable({
  transactions,
  categoryById,
  onEdit,
  onDelete,
}: {
  transactions: Array<Transaction>;
  categoryById: Map<string, TransactionCategory>;
  onEdit: (mode: TransactionFormMode) => void;
  onDelete: (transaction: Transaction) => void;
}) {
  return (
    <Table className="border text-sm">
      <TableHeader className="bg-muted/40 text-left">
        <TableRow>
          <TableHead className="w-px whitespace-nowrap p-3 font-medium">
            Date
          </TableHead>
          <TableHead className="w-px whitespace-nowrap p-3 font-medium">
            Type
          </TableHead>
          <TableHead className="w-px whitespace-nowrap p-3 font-medium">
            Category
          </TableHead>
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

          return (
            <TableRow key={transaction.id} className="border-t">
              <TableCell className="whitespace-nowrap p-3">
                {toDateTimeInputValue(transaction.transactionDate)}
              </TableCell>
              <TableCell className="whitespace-nowrap p-3 capitalize">
                {transaction.transactionType}
              </TableCell>
              <TableCell className="whitespace-nowrap p-3">
                {category ? (
                  <span className="inline-flex items-center gap-2">
                    <ColorDot color={getCategoryDisplayColor(category)} />
                    {getCategoryDisplayName(category, categoryById)}
                  </span>
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
              <TableCell className="sticky right-0 z-10 p-3">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit({ type: "edit", transaction })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(transaction)}
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
  );
}

export { TransactionTable };
