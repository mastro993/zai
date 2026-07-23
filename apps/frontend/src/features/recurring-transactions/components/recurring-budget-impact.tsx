import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { budgetStatusLabel, formatBudgetPeriod } from "@/features/budgets/lib/budget";
import { formatCurrencyFromMinor } from "@/lib/currency";

import { formatProjectionSourceErrorKind } from "../lib/forecast-matrix";
import type { RecurringTransactionDocument } from "../types/recurring-transaction";

interface RecurringBudgetImpactProps {
  impact: RecurringTransactionDocument["budgetImpact"];
}

function ForecastStatus({
  complete,
  partial,
  status,
  coveredUntil,
}: {
  complete: boolean;
  partial: boolean;
  status: "onTrack" | "warning" | "overspent" | null | undefined;
  coveredUntil: string;
}) {
  if (partial) {
    return <Badge variant="secondary">Partial through {coveredUntil.slice(0, 10)}</Badge>;
  }
  if (!complete || status == null) {
    return <Badge variant="secondary">Status withheld</Badge>;
  }
  return <Badge variant="outline">Forecast · {budgetStatusLabel[status]}</Badge>;
}

function formatCoverage(partial: boolean, coveredUntil: string) {
  return partial ? "Partial through " + coveredUntil.slice(0, 10) : "Full period";
}

export function RecurringBudgetImpact({ impact }: RecurringBudgetImpactProps) {
  const projection = impact.projection;
  if (!projection) {
    return null;
  }

  const attributions = projection.periods.flatMap((period) =>
    period.attribution.map((attribution) => ({ attribution, period })),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Computed from {projection.observedLocal.slice(0, 16)} through{" "}
          {projection.throughLocal.slice(0, 16)}. Recorded budget state stays unchanged.
        </p>
        <Badge variant={projection.complete ? "outline" : "secondary"}>
          {projection.complete ? "Complete snapshot" : "Incomplete snapshot"}
        </Badge>
      </div>

      {!projection.complete || projection.sourceErrors.length > 0 ? (
        <div
          role="status"
          aria-label="Budget forecast source issues"
          className="flex flex-col gap-2 border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-medium text-destructive">Forecast incomplete</p>
          <p className="text-muted-foreground">
            Valid contributions remain visible. Unreliable aggregate status is withheld.
          </p>
          {projection.sourceErrors.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {projection.sourceErrors.map((error, index) => (
                <li
                  key={error.kind + "-" + (error.recurringTransactionId ?? error.budgetId ?? index)}
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

      <div className="overflow-x-auto border">
        <Table aria-label="Recurring budget impact by period" className="min-w-[52rem] text-sm">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Budget</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Projected change</TableHead>
              <TableHead className="text-right">Combined forecast</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projection.periods.map((period) => (
              <TableRow key={period.budgetId + "-" + period.periodStart}>
                <TableCell className="font-medium">{period.budgetName}</TableCell>
                <TableCell>{formatBudgetPeriod(period.periodStart, period.periodEnd)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrencyFromMinor(period.actualNetBudgetSpending, "EUR")}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrencyFromMinor(period.projectedDelta, "EUR")}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrencyFromMinor(period.forecastNetBudgetSpending, "EUR")}
                </TableCell>
                <TableCell>{formatCoverage(period.partial, period.coveredUntil)}</TableCell>
                <TableCell>
                  <ForecastStatus
                    complete={projection.complete}
                    partial={period.partial}
                    status={period.status}
                    coveredUntil={period.coveredUntil}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section aria-label="Projected occurrence attribution" className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Projected occurrence attribution</h3>
        {attributions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projected occurrence from this source is included in an active budget period.
          </p>
        ) : (
          <ul className="flex flex-col divide-y border">
            {attributions.map(({ attribution, period }) => (
              <li
                key={
                  attribution.scheduleRevisionId + "-" + attribution.ordinal + "-" + period.budgetId
                }
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <Link
                  to="/cash-flow/recurring/$recurringTransactionId"
                  params={{ recurringTransactionId: attribution.recurringTransactionId }}
                  className="underline-offset-2 hover:underline"
                  aria-label={"Open recurring source for " + attribution.description}
                >
                  <span className="block font-medium">{attribution.description}</span>
                  <span className="block text-xs text-muted-foreground">
                    {period.budgetName} · {attribution.scheduledLocal.slice(0, 16)} · occurrence{" "}
                    {attribution.ordinal}
                  </span>
                </Link>
                <span className="tabular-nums">
                  {formatCurrencyFromMinor(attribution.contribution, "EUR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
