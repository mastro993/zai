import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ScreenBase } from "@/components/screen-base";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  BUDGET_FORECASTS,
  SOURCE_ERRORS,
  slicePeriods,
  type BudgetForecast,
  type PeriodForecast,
} from "./data";
import {
  AttributionList,
  HorizonControl,
  IncompleteBanner,
  StateDump,
  StatusBadge,
  money,
} from "./shared";

export const VARIANT_B_META = { key: "B", name: "Period matrix board" } as const;

// Variant B: dedicated forecast board — budgets × periods matrix is the primary surface.
export function VariantB() {
  const [horizonMonths, setHorizonMonths] = useState(6);
  const [includePaused, setIncludePaused] = useState(false);
  const [cell, setCell] = useState<{ budgetId: string; periodLabel: string } | null>(null);
  const [selectedRecurringId, setSelectedRecurringId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState("Opened period matrix board");

  const complete = SOURCE_ERRORS.length === 0;
  const rows = BUDGET_FORECASTS.filter((budget) => includePaused || !budget.paused);
  const periodLabels = useMemo(() => {
    const first = rows[0] ?? BUDGET_FORECASTS[0];
    return first ? slicePeriods(first, horizonMonths).map((period) => period.periodLabel) : [];
  }, [rows, horizonMonths]);

  const selected = findCell(rows, cell);

  return (
    <ScreenBase
      actions={
        <>
          <HorizonControl
            value={horizonMonths}
            onChange={(months) => {
              setHorizonMonths(months);
              setLastAction(`Horizon → ${months} mo`);
            }}
          />
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={includePaused ? ["paused"] : []}
            onValueChange={(values) => {
              const next = values.includes("paused");
              setIncludePaused(next);
              setLastAction(next ? "Include paused" : "Active only");
            }}
          >
            <ToggleGroupItem value="paused">Paused</ToggleGroupItem>
          </ToggleGroup>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Forecast</h1>
          <p className="text-sm text-muted-foreground">
            PROTOTYPE B — first-class board under Cash flow. Matrix owns global projection.
            Recurring document keeps per-source impact table.
          </p>
        </div>

        <IncompleteBanner
          onFocus={(id) => {
            setSelectedRecurringId(id);
            setLastAction(`Focus source ${id}`);
          }}
        />

        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 font-medium">Budget</th>
                {periodLabels.map((label) => (
                  <th key={label} className="px-3 py-2 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((budget) => (
                <tr key={budget.id} className="border-b border-border">
                  <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium">
                    <div className="flex items-center gap-2">
                      {budget.name}
                      {budget.paused ? <Badge variant="secondary">Paused</Badge> : null}
                    </div>
                    <div className="text-xs font-normal text-muted-foreground">
                      Actual {money(budget.currentActualSpendingMinor)} ·{" "}
                      <StatusBadge status={budget.currentStatus} />
                    </div>
                  </th>
                  {slicePeriods(budget, horizonMonths).map((period) => {
                    const active =
                      cell?.budgetId === budget.id && cell.periodLabel === period.periodLabel;
                    return (
                      <td key={period.periodLabel} className="p-1 align-top">
                        <button
                          type="button"
                          className={`block w-full space-y-1 border p-2 text-left ${
                            active
                              ? "border-foreground bg-muted/50"
                              : "border-transparent hover:border-border hover:bg-muted/30"
                          }`}
                          onClick={() => {
                            setCell({ budgetId: budget.id, periodLabel: period.periodLabel });
                            setLastAction(`Cell ${budget.name} / ${period.periodLabel}`);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">actual</span>
                            <span className="tabular-nums">
                              {money(period.actualSpendingMinor)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">+ proj</span>
                            <span className="tabular-nums text-muted-foreground">
                              {money(period.projectedDeltaMinor)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 border-t border-border pt-1">
                            <span className="text-xs font-medium">forecast</span>
                            <span className="tabular-nums font-medium">
                              {money(Math.abs(period.forecastSpendingMinor))}
                            </span>
                          </div>
                          {period.partial ? (
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Partial → {period.coverageThrough}
                            </div>
                          ) : (
                            <StatusBadge
                              forecast
                              status={complete ? period.forecastStatus : null}
                            />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected ? (
          <section className="grid gap-4 border border-border p-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-2">
              <h2 className="text-lg font-medium">
                {selected.budget.name} · {selected.period.periodLabel}
              </h2>
              <p className="text-sm text-muted-foreground">
                Forecast values non-authoritative. Actual period state unchanged.
              </p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Actual spending</dt>
                  <dd className="tabular-nums">{money(selected.period.actualSpendingMinor)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Projected Δ</dt>
                  <dd className="tabular-nums">{money(selected.period.projectedDeltaMinor)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Forecast remaining</dt>
                  <dd className="tabular-nums">{money(selected.period.forecastRemainingMinor)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Coverage</dt>
                  <dd>
                    {selected.period.partial
                      ? `Partial through ${selected.period.coverageThrough}`
                      : "Full period"}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Source attribution</h3>
              <AttributionList
                items={selected.period.attributions}
                onOpen={(id, name) => {
                  setSelectedRecurringId(id);
                  setLastAction(`Nav → recurring ${name}`);
                }}
              />
            </div>
          </section>
        ) : null}

        <StateDump
          variant="B"
          horizonMonths={horizonMonths}
          includePaused={includePaused}
          selectedBudgetId={cell?.budgetId ?? null}
          selectedRecurringId={selectedRecurringId}
          lastAction={lastAction}
        />
      </div>
    </ScreenBase>
  );
}

function findCell(
  rows: Array<BudgetForecast>,
  cell: { budgetId: string; periodLabel: string } | null,
): { budget: BudgetForecast; period: PeriodForecast } | null {
  if (!cell) {
    return null;
  }
  const budget = rows.find((row) => row.id === cell.budgetId);
  if (!budget) {
    return null;
  }
  const period = budget.periods.find((item) => item.periodLabel === cell.periodLabel);
  if (!period) {
    return null;
  }
  return { budget, period };
}
