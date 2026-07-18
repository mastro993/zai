import { Badge } from "@/components/ui/badge";
import { formatCurrencyFromMinor } from "@/lib/currency";

import type { CountMode, RecurringLifecycle, RecurringPrototype } from "./data";

export function lifecycleBadgeVariant(
  lifecycle: RecurringLifecycle,
): "default" | "secondary" | "outline" | "destructive" {
  if (lifecycle === "active") {
    return "default";
  }
  if (lifecycle === "paused") {
    return "secondary";
  }
  if (lifecycle === "completed") {
    return "outline";
  }
  return "destructive";
}

export function formatCount(item: RecurringPrototype) {
  if (item.countMode === "indefinite") {
    return `${item.fulfilled} fulfilled · indefinite`;
  }
  const remaining = (item.total ?? 0) - item.fulfilled;
  return `${item.fulfilled}/${item.total} · ${remaining} remaining`;
}

export function progressRatio(item: RecurringPrototype) {
  if (item.countMode === "indefinite" || !item.total) {
    return null;
  }
  return item.fulfilled / item.total;
}

export function amountLabel(amountMinor: number, currency = "EUR") {
  return formatCurrencyFromMinor(amountMinor, currency);
}

export function CountModeLabel({ mode }: { mode: CountMode }) {
  return <Badge variant="outline">{mode === "finite" ? "Finite" : "Indefinite"}</Badge>;
}

export function LifecycleBadge({ lifecycle }: { lifecycle: RecurringLifecycle }) {
  return <Badge variant={lifecycleBadgeVariant(lifecycle)}>{lifecycle}</Badge>;
}

export function ProgressBar({ item }: { item: RecurringPrototype }) {
  const ratio = progressRatio(item);
  if (ratio === null) {
    return <div className="text-xs text-muted-foreground">Indefinite — no finite progress bar</div>;
  }
  return (
    <div className="space-y-1">
      <div className="h-2 w-full bg-muted">
        <div className="h-2 bg-primary" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">{formatCount(item)}</div>
    </div>
  );
}

export function StateDump({
  selectedId,
  filter,
  lastAction,
}: {
  selectedId: string | null;
  filter: string;
  lastAction: string;
}) {
  return (
    <pre className="overflow-x-auto border border-dashed border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
      {JSON.stringify({ selectedId, filter, lastAction, tombstonesVisible: false }, null, 2)}
    </pre>
  );
}
