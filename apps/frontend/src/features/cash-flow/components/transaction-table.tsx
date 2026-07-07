import { Button } from "@/components/ui/button";
import { formatCurrencyFromMinor } from "@/lib/currency";

import { getCategoryDisplayColor } from "../lib/category";
import { toDateTimeInputValue } from "../lib/transaction";
import type { TransactionFormMode } from "../types/transaction-types";
import type { Transaction, TransactionCategory } from "../types/model";
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
    <div className="overflow-x-auto border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="p-3 font-medium">Date</th>
            <th className="p-3 font-medium">Description</th>
            <th className="p-3 font-medium">Type</th>
            <th className="p-3 font-medium">Category</th>
            <th className="p-3 text-right font-medium">Amount</th>
            <th className="p-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const category = transaction.transactionCategoryId
              ? categoryById.get(transaction.transactionCategoryId)
              : undefined;

            return (
              <tr key={transaction.id} className="border-t">
                <td className="p-3">{toDateTimeInputValue(transaction.transactionDate)}</td>
                <td className="p-3">{transaction.description || "No description"}</td>
                <td className="p-3 capitalize">{transaction.transactionType}</td>
                <td className="p-3">
                  {category ? (
                    <span className="inline-flex items-center gap-2">
                      <ColorDot color={getCategoryDisplayColor(category)} />
                      {category.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Uncategorized</span>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {formatCurrencyFromMinor(transaction.amount, "EUR")}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit({ type: "edit", transaction })}
                    >
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => onDelete(transaction)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { TransactionTable };
