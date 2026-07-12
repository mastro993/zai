import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenBase } from "@/components/screen-base";
import { formatCurrencyFromMinor } from "@/lib/currency";

import {
  budgetCadenceLabel,
  budgetMeasurementLabel,
  budgetStatusLabel,
  budgetStatusVariant,
} from "../lib/budget";
import type { Budget } from "../types/budget";

export function BudgetDetailScreen({ budget }: { budget: Budget }) {
  const period = budget.currentPeriod;

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
          <Detail
            label="Period"
            value={`${period.start.slice(0, 10)} to ${period.end.slice(0, 10)}`}
          />
          <Detail
            label="Scope"
            value={
              budget.categoryIds.length === 0
                ? "All transactions"
                : `${budget.categoryIds.length} categories`
            }
          />
          <Detail label="Measurement" value={budgetMeasurementLabel[budget.measurementMode]} />
          <Detail label="Rollover" value="Disabled" />
          <Detail
            label="Warning"
            value={budget.warningPercentage ? `${budget.warningPercentage}%` : "Disabled"}
          />
          <Detail label="Cadence" value={budgetCadenceLabel[budget.cadence]} />
        </dl>
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
