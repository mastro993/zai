import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenBase } from "@/components/screen-base";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  BUDGET_FORECASTS,
  SOURCE_ERRORS,
  aggregateProjectedDelta,
  slicePeriods,
  type BudgetForecast,
  type SourceAttribution,
} from "./data";
import {
  AttributionList,
  HorizonControl,
  IncompleteBanner,
  StateDump,
  StatusBadge,
  deltaLabel,
  money,
} from "./shared";

export const VARIANT_A_META = { key: "A", name: "List delta strip" } as const;

// Variant A: enhance budgets list — actual vs projected Δ vs forecast columns + attribution sheet.
export function VariantA() {
  const [horizonMonths, setHorizonMonths] = useState(6);
  const [includePaused, setIncludePaused] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRecurringId, setSelectedRecurringId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState("Opened list delta strip");

  const complete = SOURCE_ERRORS.length === 0;
  const rows = BUDGET_FORECASTS.filter((budget) => includePaused || !budget.paused);
  const selected = BUDGET_FORECASTS.find((budget) => budget.id === selectedId) ?? null;
  const attributions = useMemo(
    () => collectAttributions(selected, horizonMonths),
    [selected, horizonMonths],
  );

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
          <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            PROTOTYPE A — list stays home. Forecast columns + sheet. Per-recurring table stays on
            recurring document.
          </p>
        </div>

        <IncompleteBanner
          onFocus={(id) => {
            setSelectedRecurringId(id);
            setLastAction(`Focus source ${id}`);
          }}
        />

        <div className="border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Budget</TableHead>
                <TableHead className="text-right">Actual now</TableHead>
                <TableHead className="text-right">Projected Δ</TableHead>
                <TableHead className="text-right">Forecast spend</TableHead>
                <TableHead>Actual status</TableHead>
                <TableHead>Forecast status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((budget) => {
                const windowPeriods = slicePeriods(budget, horizonMonths);
                const lastFull = windowPeriods.findLast((period) => !period.partial);
                const projected = aggregateProjectedDelta(budget, horizonMonths);
                const hasPartial = windowPeriods.some((period) => period.partial);
                return (
                  <TableRow
                    key={budget.id}
                    className={selectedId === budget.id ? "bg-muted/40" : undefined}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="flex items-center gap-2 font-medium underline-offset-2 hover:underline"
                        onClick={() => {
                          setSelectedId(budget.id);
                          setLastAction(`Inspect ${budget.name}`);
                        }}
                      >
                        {budget.name}
                        {budget.paused ? <Badge variant="secondary">Paused</Badge> : null}
                        {hasPartial ? <Badge variant="outline">Partial edge</Badge> : null}
                      </button>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(budget.currentActualSpendingMinor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {deltaLabel(projected)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lastFull ? money(Math.abs(lastFull.forecastSpendingMinor)) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={budget.currentStatus} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        forecast
                        status={complete && lastFull ? lastFull.forecastStatus : null}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {selected ? (
          <section className="space-y-3 border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">{selected.name} · source attribution</h2>
                <p className="text-sm text-muted-foreground">
                  Actual baseline untouched. Links open recurring document (stub).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedId(null);
                  setLastAction("Closed attribution");
                }}
              >
                Close
              </Button>
            </div>
            <AttributionList
              items={attributions}
              onOpen={(id, name) => {
                setSelectedRecurringId(id);
                setLastAction(`Nav → recurring ${name}`);
              }}
            />
          </section>
        ) : null}

        <StateDump
          variant="A"
          horizonMonths={horizonMonths}
          includePaused={includePaused}
          selectedBudgetId={selectedId}
          selectedRecurringId={selectedRecurringId}
          lastAction={lastAction}
        />
      </div>
    </ScreenBase>
  );
}

function collectAttributions(
  budget: BudgetForecast | null,
  horizonMonths: number,
): Array<SourceAttribution> {
  if (!budget) {
    return [];
  }
  return slicePeriods(budget, horizonMonths).flatMap((period) => period.attributions);
}
