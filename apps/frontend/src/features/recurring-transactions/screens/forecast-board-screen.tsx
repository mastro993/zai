import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Result } from "@praha/byethrow";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { ScreenBase } from "@/components/screen-base";
import { Skeleton } from "@/components/ui/skeleton";

import { getRecurringBudgetProjections } from "../commands/recurring-transactions";
import { ForecastCellDetail } from "../components/forecast-cell-detail";
import { ForecastMatrixTable } from "../components/forecast-matrix-table";
import {
  buildForecastMatrix,
  FORECAST_HORIZON_MONTHS,
  formatProjectionSourceErrorKind,
} from "../lib/forecast-matrix";
import type { BudgetPeriodForecast, BudgetProjectionResult } from "../types/budget-projection";

const DEFAULT_HORIZON_MONTHS = 6;

interface ForecastBoardScreenProps {
  initialProjection: BudgetProjectionResult;
}

export function ForecastBoardScreen({ initialProjection }: ForecastBoardScreenProps) {
  const [projection, setProjection] = useState(initialProjection);
  const [horizonMonths, setHorizonMonths] = useState(initialProjection.horizonMonths);
  const [includePausedBudgets, setIncludePausedBudgets] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();
  const [selectedPeriod, setSelectedPeriod] = useState<BudgetPeriodForecast | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const matrix = buildForecastMatrix(projection);
  const isEmpty = matrix.rows.length === 0;

  const refresh = async (nextHorizon: number, nextIncludePaused: boolean) => {
    setIsUpdating(true);
    setRefreshError(undefined);
    const result = await getRecurringBudgetProjections({
      horizonMonths: nextHorizon,
      includePausedBudgets: nextIncludePaused,
    });
    if (Result.isSuccess(result)) {
      setProjection(result.value);
      setHorizonMonths(nextHorizon);
      setIncludePausedBudgets(nextIncludePaused);
    } else {
      setRefreshError(result.error.message);
    }
    setIsUpdating(false);
  };

  const openCell = (period: BudgetPeriodForecast, button: HTMLButtonElement) => {
    openerRef.current = button;
    setSelectedPeriod(period);
  };

  const onDetailOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedPeriod(null);
      queueMicrotask(() => {
        openerRef.current?.focus();
      });
    }
  };

  return (
    <ScreenBase
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Horizon</span>
            <input
              aria-label="Horizon"
              className="w-28 accent-foreground"
              max={FORECAST_HORIZON_MONTHS.max}
              min={FORECAST_HORIZON_MONTHS.min}
              type="range"
              value={horizonMonths}
              disabled={isUpdating}
              onChange={(event) => {
                void refresh(Number(event.target.value), includePausedBudgets);
              }}
            />
            <span className="min-w-12 tabular-nums">{horizonMonths} mo</span>
          </label>
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-paused-budgets"
              checked={includePausedBudgets}
              disabled={isUpdating}
              onCheckedChange={(checked) => {
                void refresh(horizonMonths, checked === true);
              }}
            />
            <Label htmlFor="include-paused-budgets">Include paused budgets or history</Label>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="sr-only" aria-live="polite">
          {isUpdating
            ? "Updating forecast"
            : refreshError
              ? `Forecast refresh failed: ${refreshError}`
              : projection.complete
                ? "Forecast ready"
                : "Forecast status incomplete"}
        </div>

        {!projection.complete || projection.sourceErrors.length > 0 ? (
          <div
            role="status"
            className="flex flex-col gap-2 border border-destructive/40 bg-destructive/5 p-3 text-sm"
          >
            <div className="font-medium text-destructive">Forecast incomplete</div>
            <p className="text-muted-foreground">
              Valid contributions stay visible. Failed sources contribute nothing. Aggregate
              forecast status is withheld.
            </p>
            {projection.sourceErrors.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {projection.sourceErrors.map((error, index) => (
                  <li
                    key={`${error.kind}-${error.recurringTransactionId ?? error.budgetId ?? index}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Badge variant="outline">{formatProjectionSourceErrorKind(error.kind)}</Badge>
                    <span className="text-muted-foreground">{error.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {refreshError ? (
          <p
            role="alert"
            className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {refreshError}
          </p>
        ) : null}

        {isUpdating ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Updating forecast…
          </p>
        ) : null}

        {isEmpty ? (
          <Empty
            role="region"
            aria-labelledby="forecast-empty-state-title"
            className="flex-none min-h-72 rounded-lg border px-6 py-10 sm:px-8"
          >
            <EmptyHeader className="max-w-md gap-1.5">
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle
                id="forecast-empty-state-title"
                role="heading"
                aria-level={2}
                className="text-base"
              >
                No forecast periods
              </EmptyTitle>
              <EmptyDescription>
                Create an active budget and recurring source, or include paused budgets to inspect
                history.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="max-w-none flex-row flex-wrap justify-center">
              <Button nativeButton={false} render={<Link to="/cash-flow/budgets" />}>
                Open budgets
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/cash-flow/recurring" />}
              >
                Open recurring transactions
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ForecastMatrixTable
            matrix={matrix}
            complete={projection.complete}
            isUpdating={isUpdating}
            onOpenCell={openCell}
          />
        )}
      </div>

      <ForecastCellDetail
        open={selectedPeriod !== null}
        period={selectedPeriod}
        onOpenChange={onDetailOpenChange}
      />
    </ScreenBase>
  );
}

export function ForecastBoardSkeleton() {
  return (
    <ScreenBase>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Loading forecast…
      </p>
      <div className="border">
        <div className="border-b bg-muted/40 px-3 py-2">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col gap-3 p-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </ScreenBase>
  );
}

export function ForecastErrorScreen({ message }: { message: string }) {
  return (
    <ScreenBase>
      <div
        role="alert"
        className="border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
      >
        {message}
      </div>
    </ScreenBase>
  );
}

export { DEFAULT_HORIZON_MONTHS };
