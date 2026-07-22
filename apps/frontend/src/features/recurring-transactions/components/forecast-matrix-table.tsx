import type { KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { budgetStatusLabel } from "@/features/budgets/lib/budget";
import { formatCurrencyFromMinor } from "@/lib/currency";

import type { ForecastMatrix } from "../lib/forecast-matrix";
import type { BudgetPeriodForecast } from "../types/budget-projection";

interface ForecastMatrixTableProps {
  matrix: ForecastMatrix;
  complete: boolean;
  isUpdating: boolean;
  onOpenCell: (period: BudgetPeriodForecast, button: HTMLButtonElement) => void;
}

function ForecastStatusBadge({
  period,
  complete,
}: {
  period: BudgetPeriodForecast;
  complete: boolean;
}) {
  if (period.partial) {
    return (
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Partial → {period.coveredUntil.slice(0, 10)}
      </span>
    );
  }
  if (!complete || period.status == null) {
    return <Badge variant="secondary">Status withheld</Badge>;
  }
  return <Badge variant="outline">Forecast · {budgetStatusLabel[period.status]}</Badge>;
}

const cellButtonSelector = 'button[data-forecast-cell="true"]';

const focusNeighbor = (
  current: HTMLButtonElement,
  direction: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
) => {
  const row = Number(current.dataset.row);
  const column = Number(current.dataset.column);
  if (Number.isNaN(row) || Number.isNaN(column)) {
    return;
  }
  const delta =
    direction === "ArrowUp"
      ? { row: -1, column: 0 }
      : direction === "ArrowDown"
        ? { row: 1, column: 0 }
        : direction === "ArrowLeft"
          ? { row: 0, column: -1 }
          : { row: 0, column: 1 };
  const next = current
    .closest("table")
    ?.querySelector<HTMLButtonElement>(
      `${cellButtonSelector}[data-row="${row + delta.row}"][data-column="${column + delta.column}"]`,
    );
  next?.focus();
};

export function ForecastMatrixTable({
  matrix,
  complete,
  isUpdating,
  onOpenCell,
}: ForecastMatrixTableProps) {
  const onCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, period: BudgetPeriodForecast) => {
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight"
    ) {
      event.preventDefault();
      focusNeighbor(event.currentTarget, event.key);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenCell(period, event.currentTarget);
    }
  };

  return (
    <div className="border" aria-busy={isUpdating}>
      <Table className="min-w-[48rem] text-sm" aria-label="Budget forecast matrix">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead scope="col" className="sticky left-0 z-10 bg-muted/40 px-3">
              Budget
            </TableHead>
            {matrix.columns.map((column) => (
              <TableHead key={column.periodStart} scope="col" className="px-3">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.rows.map((row, rowIndex) => (
            <TableRow key={row.budgetId}>
              <TableHead
                scope="row"
                className="sticky left-0 z-10 bg-background px-3 text-left font-medium text-foreground"
              >
                {row.budgetName}
              </TableHead>
              {row.cells.map((cell, columnIndex) => {
                const column = matrix.columns[columnIndex];
                if (!cell || !column) {
                  return (
                    <TableCell
                      key={`${row.budgetId}-${column?.periodStart ?? columnIndex}`}
                      className="p-1 whitespace-normal"
                    >
                      <span className="sr-only">No period</span>
                    </TableCell>
                  );
                }
                return (
                  <TableCell
                    key={`${row.budgetId}-${column.periodStart}`}
                    className="p-1 align-top whitespace-normal"
                  >
                    <button
                      type="button"
                      data-forecast-cell="true"
                      data-row={rowIndex}
                      data-column={columnIndex}
                      className="block w-full space-y-1 border border-dashed border-border/80 bg-muted/20 p-2 text-left hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label={`${row.budgetName}, ${column.label}`}
                      onClick={(event) => onOpenCell(cell, event.currentTarget)}
                      onKeyDown={(event) => onCellKeyDown(event, cell)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">actual</span>
                        <span className="tabular-nums">
                          {formatCurrencyFromMinor(cell.actualNetBudgetSpending, "EUR")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">+ proj</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatCurrencyFromMinor(cell.projectedDelta, "EUR")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-1">
                        <span className="text-xs font-medium text-muted-foreground">forecast</span>
                        <span className="tabular-nums font-medium text-muted-foreground">
                          {formatCurrencyFromMinor(cell.forecastNetBudgetSpending, "EUR")}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {cell.partial
                          ? `Coverage partial through ${cell.coveredUntil.slice(0, 10)}`
                          : "Coverage full period"}
                        {" · "}
                        {complete && !cell.partial ? "Complete" : "Incomplete"}
                      </div>
                      <ForecastStatusBadge period={cell} complete={complete} />
                    </button>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
