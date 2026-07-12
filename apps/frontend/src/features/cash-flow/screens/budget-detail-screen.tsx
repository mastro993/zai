import { Result } from "@praha/byethrow";
import { Link } from "@tanstack/react-router";
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

import { getBudgetHistory } from "../commands/budgets";
import {
  budgetCadenceLabel,
  budgetMeasurementLabel,
  budgetRolloverLabel,
  budgetStatusLabel,
  budgetStatusVariant,
  formatBudgetPeriod,
} from "../lib/budget";
import type { Budget, BudgetHistory } from "../types/budget";

export function BudgetDetailScreen({
  budget,
  history: initialHistory,
}: {
  budget: Budget;
  history: BudgetHistory;
}) {
  const period = budget.currentPeriod;
  const [history, setHistory] = useState(initialHistory);
  const [historyError, setHistoryError] = useState<string>();
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const changeHistoryPage = async (page: number) => {
    if (page < 1 || page > history.totalPages || isHistoryLoading) {
      return;
    }
    setIsHistoryLoading(true);
    setHistoryError(undefined);
    const result = await getBudgetHistory(budget.id, page, history.perPage);
    if (Result.isFailure(result)) {
      setHistoryError(result.error.message);
    } else {
      setHistory(result.value);
    }
    setIsHistoryLoading(false);
  };

  return (
    <ScreenBase
      actions={
        <Button variant="outline" render={<Link to="/cash-flow/budgets" />}>
          Back to budgets
        </Button>
      }
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium">{budget.name}</h1>
        <p className="text-sm text-muted-foreground">
          {budgetMeasurementLabel[budget.measurementMode]} budget.
        </p>
      </div>
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
              budget.categoryIds.length === 0
                ? "All transactions"
                : `${budget.categoryIds.length} categories`
            }
          />
          <Detail label="Measurement" value={budgetMeasurementLabel[budget.measurementMode]} />
          <Detail label="Rollover" value={budgetRolloverLabel[budget.rolloverMode]} />
          <Detail
            label="Warning"
            value={budget.warningPercentage ? `${budget.warningPercentage}%` : "Disabled"}
          />
          <Detail label="Cadence" value={budgetCadenceLabel[budget.cadence]} />
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
