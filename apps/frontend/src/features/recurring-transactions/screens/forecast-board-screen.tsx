import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium">Forecast</h1>
          <p className="text-sm text-muted-foreground">
            Projected budget impact across periods. Forecast values are non-authoritative and do not
            change recorded budget state.
          </p>
        </div>

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
          <div className="flex flex-col gap-1 border p-6">
            <p className="text-sm font-medium">No forecast periods</p>
            <p className="text-sm text-muted-foreground">
              Create an active budget and recurring source, or include paused budgets to inspect
              history.
            </p>
          </div>
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
      <h1 className="text-2xl font-medium">Forecast</h1>
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
