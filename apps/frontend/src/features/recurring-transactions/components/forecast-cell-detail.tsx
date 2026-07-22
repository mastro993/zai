import { Link } from "@tanstack/react-router";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrencyFromMinor } from "@/lib/currency";
import { formatBudgetPeriod } from "@/features/budgets/lib/budget";

import type { BudgetPeriodForecast } from "../types/budget-projection";

interface ForecastCellDetailProps {
  open: boolean;
  period: BudgetPeriodForecast | null;
  onOpenChange: (open: boolean) => void;
}

export function ForecastCellDetail({ open, period, onOpenChange }: ForecastCellDetailProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {period ? (
          <>
            <SheetHeader>
              <SheetTitle>
                {period.budgetName} · {formatBudgetPeriod(period.periodStart, period.periodEnd)}
              </SheetTitle>
              <SheetDescription>
                Forecast values are projected and non-authoritative. Actual budget state is
                unchanged.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 overflow-y-auto p-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Actual</dt>
                  <dd className="tabular-nums">
                    {formatCurrencyFromMinor(period.actualNetBudgetSpending, "EUR")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Projected Δ</dt>
                  <dd className="tabular-nums text-muted-foreground">
                    {formatCurrencyFromMinor(period.projectedDelta, "EUR")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Forecast</dt>
                  <dd className="tabular-nums font-medium">
                    {formatCurrencyFromMinor(period.forecastNetBudgetSpending, "EUR")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Coverage</dt>
                  <dd>
                    {period.partial
                      ? `Partial through ${period.coveredUntil.slice(0, 10)}`
                      : "Full period"}
                  </dd>
                </div>
              </dl>
              <section aria-labelledby="forecast-attribution-heading">
                <h3 id="forecast-attribution-heading" className="mb-2 text-sm font-medium">
                  Source attribution
                </h3>
                {period.attribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No projected sources in this period.
                  </p>
                ) : (
                  <ul className="divide-y divide-border border border-border">
                    {period.attribution.map((item) => (
                      <li
                        key={`${item.recurringTransactionId}-${item.scheduleRevisionId}-${item.ordinal}`}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <Link
                          aria-label={item.description}
                          className="text-left underline-offset-2 hover:underline"
                          to="/cash-flow/recurring/$recurringTransactionId"
                          params={{ recurringTransactionId: item.recurringTransactionId }}
                        >
                          <span className="block font-medium">{item.description}</span>
                          <span className="block text-xs text-muted-foreground">
                            {item.scheduledLocal.slice(0, 16)} · occurrence {item.ordinal}
                          </span>
                        </Link>
                        <span className="tabular-nums">
                          {formatCurrencyFromMinor(item.contribution, "EUR")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
