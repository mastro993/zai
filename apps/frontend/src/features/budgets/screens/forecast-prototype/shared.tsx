import { Badge } from "@/components/ui/badge";
import { formatCurrencyFromMinor } from "@/lib/currency";

import {
  AS_OF,
  CURRENCY,
  SOURCE_ERRORS,
  type ForecastStatus,
  type SourceAttribution,
} from "./data";

export function money(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) {
    return "—";
  }
  return formatCurrencyFromMinor(minor, CURRENCY);
}

export function deltaLabel(minor: number): string {
  if (minor === 0) {
    return money(0);
  }
  const sign = minor > 0 ? "+" : "";
  return `${sign}${money(minor)}`;
}

export function statusLabel(status: ForecastStatus): string {
  if (status === null) {
    return "No forecast status";
  }
  if (status === "on_track") {
    return "On track";
  }
  if (status === "warning") {
    return "Warning";
  }
  return "Overspent";
}

export function StatusBadge({ status, forecast }: { status: ForecastStatus; forecast?: boolean }) {
  if (status === null) {
    return <Badge variant="secondary">{forecast ? "Status withheld" : "—"}</Badge>;
  }
  const variant =
    status === "on_track" ? "default" : status === "warning" ? "secondary" : "destructive";
  return (
    <Badge variant={variant}>
      {forecast ? "Forecast · " : ""}
      {statusLabel(status)}
    </Badge>
  );
}

export function IncompleteBanner({ onFocus }: { onFocus?: (id: string) => void }) {
  if (SOURCE_ERRORS.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2 border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <div className="font-medium text-destructive">Forecast incomplete</div>
      <p className="text-muted-foreground">
        Valid sources stay. Failed sources contribute nothing. Aggregate forecast status withheld.
      </p>
      <ul className="space-y-1">
        {SOURCE_ERRORS.map((error) => (
          <li key={error.recurringId} className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="underline-offset-2 hover:underline"
              onClick={() => onFocus?.(error.recurringId)}
            >
              {error.recurringName}
            </button>
            <span className="text-xs text-muted-foreground">{error.code}</span>
            <span className="text-muted-foreground">— {error.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AttributionList({
  items,
  onOpen,
}: {
  items: Array<SourceAttribution>;
  onOpen: (id: string, name: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No projected sources in this window.</p>;
  }
  return (
    <ul className="divide-y divide-border border border-border">
      {items.map((item) => (
        <li
          key={`${item.recurringId}-${item.occurrenceOn}-${item.amountMinor}`}
          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
        >
          <button
            type="button"
            className="text-left underline-offset-2 hover:underline"
            onClick={() => onOpen(item.recurringId, item.recurringName)}
          >
            <div className="font-medium">{item.recurringName}</div>
            <div className="text-xs text-muted-foreground">{item.occurrenceOn}</div>
          </button>
          <span className="tabular-nums">{money(item.amountMinor)}</span>
        </li>
      ))}
    </ul>
  );
}

export function StateDump({
  variant,
  horizonMonths,
  includePaused,
  selectedBudgetId,
  selectedRecurringId,
  lastAction,
}: {
  variant: string;
  horizonMonths: number;
  includePaused: boolean;
  selectedBudgetId: string | null;
  selectedRecurringId: string | null;
  lastAction: string;
}) {
  return (
    <pre className="overflow-x-auto border border-border bg-muted/30 p-3 text-xs leading-relaxed">
      {JSON.stringify(
        {
          prototype: "forecast-176",
          asOf: AS_OF,
          variant,
          horizonMonths,
          includePaused,
          selectedBudgetId,
          selectedRecurringId,
          complete: SOURCE_ERRORS.length === 0,
          sourceErrors: SOURCE_ERRORS,
          lastAction,
          note: "Forecast never mutates actual budget state",
        },
        null,
        2,
      )}
    </pre>
  );
}

export function HorizonControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (months: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Horizon</span>
      <input
        type="range"
        min={1}
        max={12}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-32"
      />
      <span className="min-w-16 tabular-nums">{value} mo</span>
    </label>
  );
}
