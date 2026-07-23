import { Result } from "@praha/byethrow";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { toast } from "@/components/toaster/toast";
import { ScreenBase } from "@/components/screen-base";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import type { TransactionCategory } from "@/features/categories/types/model";
import { formatCurrencyFromMinor } from "@/lib/currency";
import {
  formatLocalDateTime,
  recurringLifecycleLabel,
} from "@/features/recurring-transactions/lib/recurring";
import type { TransactionRecurringProvenance } from "@/features/recurring-transactions/types/recurring-transaction";

import { updateTransaction } from "../commands/transactions";
import { TransactionFormDrawer } from "../components/transaction-form-drawer";
import { TransactionTypeBadge } from "../components/transaction-type-badge";
import type { Transaction, TransactionFormValues } from "../types/model";

export function TransactionErrorScreen({ message }: { message: string }) {
  return (
    <ScreenBase>
      <div role="alert" className="text-sm text-destructive">
        {message}
      </div>
    </ScreenBase>
  );
}

export function TransactionDetailScreen({
  transaction: initialTransaction,
  categories,
  recurringProvenance,
}: {
  transaction: Transaction;
  categories: Array<TransactionCategory>;
  recurringProvenance: TransactionRecurringProvenance | null;
}) {
  const [transaction, setTransaction] = useState(initialTransaction);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const source = recurringProvenance?.source;
  const description = transaction.description?.trim() || "Transaction";

  const submitEdit = async (values: TransactionFormValues) => {
    const result = await updateTransaction(transaction.id, values);
    if (Result.isFailure(result)) {
      toast.error("Failed to update transaction", { description: result.error.message });
      return;
    }

    setTransaction(result.value);
    setIsEditOpen(false);
    toast.success("Transaction updated");
  };

  return (
    <ScreenBase
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            Edit transaction
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/cash-flow/transactions" />}
          >
            Back to transactions
          </Button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{description}</h1>
          <p className="text-sm text-muted-foreground">Transaction details</p>
        </div>

        <section aria-label="Transaction details" className="border-b border-border pb-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="text-base tabular-nums">
                {formatCurrencyFromMinor(transaction.amount, "EUR")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd>
                <TransactionTypeBadge type={transaction.transactionType} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Date</dt>
              <dd>{formatLocalDateTime(transaction.transactionDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Category</dt>
              <dd>
                {transaction.transactionCategoryId
                  ? (categories.find(
                      (category) => category.id === transaction.transactionCategoryId,
                    )?.name ?? "Category unavailable")
                  : "Uncategorized"}
              </dd>
            </div>
            {transaction.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-wrap">{transaction.notes}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {source ? (
          <section aria-label="Recurring source" className="space-y-3 border-b border-border pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">Recurring source</h2>
              <Badge variant="outline">
                {recurringProvenance.occurrence.fulfillmentKind === "adopted"
                  ? "Adopted"
                  : "Generated"}
              </Badge>
            </div>
            <Link
              to="/cash-flow/recurring/$recurringTransactionId"
              params={{ recurringTransactionId: source.id }}
              className="underline-offset-4 hover:underline"
              aria-label={`Open recurring source ${source.description}`}
            >
              {source.description}
            </Link>
            <p className="text-sm text-muted-foreground">
              {recurringLifecycleLabel[source.lifecycle]} source, occurrence {"#"}
              {recurringProvenance.occurrence.fulfillmentPosition}.
            </p>
          </section>
        ) : null}
      </div>

      <Drawer open={isEditOpen} onOpenChange={setIsEditOpen} swipeDirection="right">
        {isEditOpen ? (
          <TransactionFormDrawer
            key={transaction.id}
            mode={{ type: "edit", transaction }}
            categories={categories}
            open={isEditOpen}
            onSubmit={submitEdit}
            recurringProvenance={recurringProvenance}
          />
        ) : null}
      </Drawer>
    </ScreenBase>
  );
}
