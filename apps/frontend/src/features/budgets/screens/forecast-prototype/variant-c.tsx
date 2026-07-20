import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenBase } from "@/components/screen-base";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { BUDGET_FORECASTS, SOURCE_ERRORS, slicePeriods } from "./data";
import {
  AttributionList,
  HorizonControl,
  IncompleteBanner,
  StateDump,
  StatusBadge,
  money,
} from "./shared";

export const VARIANT_C_META = { key: "C", name: "Budget forward ribbon" } as const;

// Variant C: budget-detail first — horizontal period ribbon + stacked sources; picker for global reach.
export function VariantC() {
  const [horizonMonths, setHorizonMonths] = useState(7);
  const [includePaused, setIncludePaused] = useState(false);
  const [budgetId, setBudgetId] = useState("b-housing");
  const [periodLabel, setPeriodLabel] = useState<string | null>("Aug 2026");
  const [selectedRecurringId, setSelectedRecurringId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState("Opened budget forward ribbon");

  const complete = SOURCE_ERRORS.length === 0;
  const picker = BUDGET_FORECASTS.filter((budget) => includePaused || !budget.paused);
  const budget = BUDGET_FORECASTS.find((item) => item.id === budgetId) ?? BUDGET_FORECASTS[0];
  const periods = useMemo(
    () => (budget ? slicePeriods(budget, horizonMonths) : []),
    [budget, horizonMonths],
  );
  const selectedPeriod =
    periods.find((period) => period.periodLabel === periodLabel) ??
    periods[1] ??
    periods[0] ??
    null;

  if (!budget) {
    return null;
  }

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
          <h1 className="text-2xl font-semibold tracking-tight">Budget forecast</h1>
          <p className="text-sm text-muted-foreground">
            PROTOTYPE C — live on budget detail mental model. Ribbon = forward periods. Global via
            picker. No separate board.
          </p>
        </div>

        <IncompleteBanner
          onFocus={(id) => {
            setSelectedRecurringId(id);
            setLastAction(`Focus source ${id}`);
          }}
        />

        <div className="flex flex-wrap gap-2">
          {picker.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={item.id === budget.id ? "default" : "outline"}
              onClick={() => {
                setBudgetId(item.id);
                setPeriodLabel(null);
                setLastAction(`Budget → ${item.name}`);
              }}
            >
              {item.name}
              {item.paused ? " · paused" : ""}
            </Button>
          ))}
        </div>

        <section className="space-y-3 border border-border p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-medium">{budget.name}</h2>
                {budget.paused ? <Badge variant="secondary">Paused</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Actual now {money(budget.currentActualSpendingMinor)} remaining{" "}
                {money(budget.currentRemainingMinor)} ·{" "}
                <StatusBadge status={budget.currentStatus} />
              </p>
            </div>
            <p className="max-w-sm text-xs text-muted-foreground">
              Left of split = durable actual. Right = hypothetical forecast. Never persisted.
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {periods.map((period, index) => {
              const isCurrent = index === 0;
              const active = selectedPeriod?.periodLabel === period.periodLabel;
              return (
                <button
                  key={period.periodLabel}
                  type="button"
                  className={`min-w-40 shrink-0 space-y-2 border p-3 text-left ${
                    active ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/20"
                  } ${isCurrent ? "border-l-4 border-l-primary" : "border-dashed"}`}
                  onClick={() => {
                    setPeriodLabel(period.periodLabel);
                    setLastAction(`Period → ${period.periodLabel}`);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{period.periodLabel}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {isCurrent ? "actual+" : "forecast"}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">baseline</span>
                      <span className="tabular-nums">{money(period.actualSpendingMinor)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">projected</span>
                      <span className="tabular-nums">{money(period.projectedDeltaMinor)}</span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-border pt-1 font-medium">
                      <span>combined</span>
                      <span className="tabular-nums">
                        {money(Math.abs(period.forecastSpendingMinor))}
                      </span>
                    </div>
                  </div>
                  {period.partial ? (
                    <Badge variant="outline">Partial · {period.coverageThrough}</Badge>
                  ) : (
                    <StatusBadge forecast status={complete ? period.forecastStatus : null} />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {selectedPeriod ? (
          <section className="space-y-3 border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-medium">Sources · {selectedPeriod.periodLabel}</h3>
              <span className="text-xs text-muted-foreground">
                Jump to recurring document (stub)
              </span>
            </div>
            <AttributionList
              items={selectedPeriod.attributions}
              onOpen={(id, name) => {
                setSelectedRecurringId(id);
                setLastAction(`Nav → recurring ${name}`);
              }}
            />
          </section>
        ) : null}

        <StateDump
          variant="C"
          horizonMonths={horizonMonths}
          includePaused={includePaused}
          selectedBudgetId={budget.id}
          selectedRecurringId={selectedRecurringId}
          lastAction={lastAction}
        />
      </div>
    </ScreenBase>
  );
}
