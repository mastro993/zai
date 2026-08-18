import { Result } from "@praha/byethrow";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { toast } from "@/components/toaster/toast";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { ScreenBase } from "@/components/screen-base";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
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
import { formValuesFromTransaction } from "../lib/transaction-write";
import type { Transaction, TransactionFormValues } from "../types/model";

const rateOriginLabel = (origin: Transaction["exchangeRate"]["origin"]) =>
  origin === "manual" ? "Manual" : "Supplied";

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
  const [pendingManualRate, setPendingManualRate] = useState<TransactionFormValues | null>(null);
  const [recoveryRate, setRecoveryRate] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const source = recurringProvenance?.source;
  const description = transaction.description?.trim() || "Transaction";
  const convertedLabel =
    transaction.complete && transaction.convertedAmount !== null
      ? formatCurrencyFromMinor(transaction.convertedAmount, transaction.convertedCurrency)
      : "Incomplete";
  const pending = transaction.exchangeRate.variant === "pending";

  const applyUpdate = async (
    values: TransactionFormValues,
    options: { confirmManualRateReplacement?: boolean; retryRateLookup?: boolean } = {},
  ) => {
    const result = await updateTransaction(transaction.id, values, options);
    if (Result.isFailure(result)) {
      if (result.error.code === "manualRateReplacementRequired") {
        setPendingManualRate(values);
        return false;
      }
      toast.error("Failed to update transaction", { description: result.error.message });
      return false;
    }

    setTransaction(result.value);
    setPendingManualRate(null);
    return true;
  };

  const submitEdit = async (values: TransactionFormValues) => {
    const updated = await applyUpdate(values);
    if (!updated) {
      return;
    }

    setIsEditOpen(false);
    toast.success("Transaction updated");
  };

  const retryPending = async () => {
    setIsRecovering(true);
    const updated = await applyUpdate(formValuesFromTransaction(transaction), {
      retryRateLookup: true,
    });
    setIsRecovering(false);
    if (updated) {
      toast.success("Exchange rate updated");
    }
  };

  const enterPendingRate = async () => {
    const rate = recoveryRate.trim();
    if (!rate) {
      return;
    }
    setIsRecovering(true);
    const updated = await applyUpdate({
      ...formValuesFromTransaction(transaction),
      manualExchangeRate: rate,
    });
    setIsRecovering(false);
    if (updated) {
      setRecoveryRate("");
      toast.success("Exchange rate updated");
    }
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
                {convertedLabel}
                <p className="text-xs text-muted-foreground">
                  {formatCurrencyFromMinor(transaction.amount, transaction.currency)}
                  {transaction.exchangeRate.originalDecimal
                    ? ` · ${transaction.exchangeRate.originalDecimal}`
                    : ""}
                  {` · ${transaction.exchangeRate.rateDate} · ${rateOriginLabel(transaction.exchangeRate.origin)}`}
                </p>
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
          {pending ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <p>Exchange-rate pending. Cross-currency results stay incomplete.</p>
              <Button size="sm" disabled={isRecovering} onClick={() => void retryPending()}>
                Retry
              </Button>
              <Input
                className="w-28"
                aria-label="Manual recovery rate"
                value={recoveryRate}
                onChange={(event) => setRecoveryRate(event.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={isRecovering || !recoveryRate.trim()}
                onClick={() => void enterPendingRate()}
              >
                Enter rate
              </Button>
            </div>
          ) : null}
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

      <ConfirmationDialog
        open={pendingManualRate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingManualRate(null);
          }
        }}
        title="Replace the current exchange rate?"
        description={`This stores a manual exchange rate of ${pendingManualRate?.manualExchangeRate ?? ""}. The previous supplied or manual origin is replaced and stays visible as manual.`}
      >
        <Button
          size="sm"
          onClick={() => {
            if (!pendingManualRate) {
              return;
            }
            void applyUpdate(pendingManualRate, { confirmManualRateReplacement: true }).then(
              (updated) => {
                if (updated) {
                  setIsEditOpen(false);
                  toast.success("Transaction updated");
                }
              },
            );
          }}
        >
          Use manual rate
        </Button>
      </ConfirmationDialog>
    </ScreenBase>
  );
}
