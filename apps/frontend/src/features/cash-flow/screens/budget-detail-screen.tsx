import { Result } from "@praha/byethrow";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScreenBase } from "@/components/screen-base";
import { formatCurrencyFromMinor } from "@/lib/currency";

import {
  deleteBudget,
  getBudgetHistory,
  pauseBudget,
  resumeBudget,
  updateBudget,
} from "../commands/budgets";
import { BudgetDeleteConfirmationDialog } from "../components/budget-delete-confirmation-dialog";
import { BudgetFormDialog } from "../components/budget-form-dialog";
import {
  budgetCadenceLabel,
  budgetMeasurementLabel,
  budgetRolloverLabel,
  budgetStatusLabel,
  budgetStatusVariant,
  formatBudgetPeriod,
} from "../lib/budget";
import type { Budget, BudgetFormValues, BudgetHistory } from "../types/budget";
import type { TransactionCategory } from "../types/model";

export function BudgetDetailScreen({
  budget,
  history: initialHistory,
  categories,
}: {
  budget: Budget;
  history: BudgetHistory;
  categories: Array<TransactionCategory>;
}) {
  const navigate = useNavigate();
  const [currentBudget, setCurrentBudget] = useState(budget);
  const [history, setHistory] = useState(initialHistory);
  const [historyError, setHistoryError] = useState<string>();
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLifecycleLoading, setIsLifecycleLoading] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string>();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const period = currentBudget.currentPeriod;
  const actionError = deleteError ?? lifecycleError;

  const toggleBudgetPaused = async () => {
    if (isLifecycleLoading) {
      return;
    }
    setIsLifecycleLoading(true);
    setLifecycleError(undefined);
    const result = currentBudget.paused
      ? await resumeBudget(currentBudget.id, currentBudget.revision)
      : await pauseBudget(currentBudget.id, currentBudget.revision);
    if (Result.isFailure(result)) {
      setLifecycleError(
        result.error.code === "revisionConflict"
          ? "Budget changed elsewhere. Reload it before changing lifecycle."
          : result.error.message,
      );
      setIsLifecycleLoading(false);
      return;
    }

    setCurrentBudget(result.value);
    const historyResult = await getBudgetHistory(currentBudget.id);
    if (Result.isSuccess(historyResult)) {
      setHistory(historyResult.value);
    } else {
      setLifecycleError(historyResult.error.message);
    }
    setIsLifecycleLoading(false);
  };

  const changeHistoryPage = async (page: number) => {
    if (page < 1 || page > history.totalPages || isHistoryLoading) {
      return;
    }
    setIsHistoryLoading(true);
    setHistoryError(undefined);
    const result = await getBudgetHistory(currentBudget.id, page, history.perPage);
    if (Result.isFailure(result)) {
      setHistoryError(result.error.message);
    } else {
      setHistory(result.value);
    }
    setIsHistoryLoading(false);
  };

  const submitBudget = async (values: BudgetFormValues) => {
    const result = await updateBudget(currentBudget.id, currentBudget.revision, values);
    if (Result.isFailure(result)) {
      return result;
    }

    setCurrentBudget(result.value);
    setHistoryError(undefined);
    const historyResult = await getBudgetHistory(currentBudget.id);
    if (Result.isFailure(historyResult)) {
      setHistoryError(historyResult.error.message);
    } else {
      setHistory(historyResult.value);
    }
    return result;
  };

  const confirmDelete = async () => {
    if (isDeleting) {
      return;
    }
    setIsDeleting(true);
    setDeleteError(undefined);
    const result = await deleteBudget(currentBudget.id, currentBudget.revision);
    if (Result.isFailure(result)) {
      setDeleteError(
        result.error.code === "revisionConflict"
          ? "Budget changed elsewhere. Reload it before deleting."
          : result.error.message,
      );
      setIsDeleting(false);
      return;
    }

    await navigate({ to: "/cash-flow/budgets" });
  };

  return (
    <ScreenBase
      actions={
        <>
          <Button
            variant="destructive"
            disabled={isDeleting}
            aria-busy={isDeleting}
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            Delete budget
          </Button>
          <Button
            variant="outline"
            disabled={isLifecycleLoading}
            aria-busy={isLifecycleLoading}
            onClick={() => void toggleBudgetPaused()}
          >
            {isLifecycleLoading
              ? currentBudget.paused
                ? "Resuming..."
                : "Pausing..."
              : currentBudget.paused
                ? "Resume budget"
                : "Pause budget"}
          </Button>
          <Button variant="outline" onClick={() => setIsFormOpen(true)}>
            Edit budget
          </Button>
          <Button variant="outline" render={<Link to="/cash-flow/budgets" />}>
            Back to budgets
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium">{currentBudget.name}</h1>
        <p className="text-sm text-muted-foreground">
          {currentBudget.paused ? "Paused" : "Active"} ·{" "}
          {budgetMeasurementLabel[currentBudget.measurementMode]} budget.
        </p>
      </div>
      {actionError ? (
        <p
          role="alert"
          className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Effective allowance"
          value={formatCurrencyFromMinor(period.effectiveAllowance, "EUR")}
        />
        <Metric
          label="Net budget spending"
          value={formatCurrencyFromMinor(period.netBudgetSpending, "EUR")}
        />
        <Metric
          label="Remaining allowance"
          value={formatCurrencyFromMinor(period.remainingAllowance, "EUR")}
        />
        <div className="flex flex-col gap-2 border p-3">
          <span className="text-xs text-muted-foreground">Status</span>
          <Badge className="w-fit" variant={budgetStatusVariant(period.status)}>
            {budgetStatusLabel[period.status]}
          </Badge>
        </div>
      </div>
      <div className="border">
        <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">Configuration</div>
        <dl className="grid gap-3 p-3 text-sm sm:grid-cols-2">
          <Detail label="Current period" value={formatBudgetPeriod(period.start, period.end)} />
          <Detail
            label="Scope"
            value={
              currentBudget.categoryIds.length === 0
                ? "All transactions"
                : `${currentBudget.categoryIds.length} categories`
            }
          />
          <Detail
            label="Measurement"
            value={budgetMeasurementLabel[currentBudget.measurementMode]}
          />
          <Detail label="Rollover" value={budgetRolloverLabel[currentBudget.rolloverMode]} />
          <Detail
            label="Warning"
            value={
              currentBudget.warningPercentage ? `${currentBudget.warningPercentage}%` : "Disabled"
            }
          />
          <Detail label="Cadence" value={budgetCadenceLabel[currentBudget.cadence]} />
        </dl>
      </div>
      <div className="border">
        <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">Period history</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Allowance</TableHead>
              <TableHead className="text-right">Spending</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data.map((historyPeriod) => (
              <TableRow key={historyPeriod.start}>
                <TableCell>{formatBudgetPeriod(historyPeriod.start, historyPeriod.end)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyFromMinor(historyPeriod.effectiveAllowance, "EUR")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyFromMinor(historyPeriod.netBudgetSpending, "EUR")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyFromMinor(historyPeriod.remainingAllowance, "EUR")}
                </TableCell>
                <TableCell>
                  <Badge variant={budgetStatusVariant(historyPeriod.status)}>
                    {budgetStatusLabel[historyPeriod.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Page {history.page} of {Math.max(history.totalPages, 1)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={history.page <= 1 || isHistoryLoading}
              onClick={() => void changeHistoryPage(history.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={history.page >= history.totalPages || isHistoryLoading}
              onClick={() => void changeHistoryPage(history.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
        {historyError ? (
          <p role="alert" className="border-t px-3 py-2 text-sm text-destructive">
            {historyError}
          </p>
        ) : null}
      </div>
      <BudgetFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={submitBudget}
        categories={categories}
        budget={currentBudget}
        mode="edit"
      />
      <BudgetDeleteConfirmationDialog
        budget={currentBudget}
        open={isDeleteDialogOpen}
        isDeleting={isDeleting}
        onOpenChange={setIsDeleteDialogOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            setDeleteError(undefined);
          }
        }}
        onDelete={() => void confirmDelete()}
      />
    </ScreenBase>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
