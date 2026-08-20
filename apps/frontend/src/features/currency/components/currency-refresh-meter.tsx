import { Badge } from "@/components/ui/badge";
import { Progress, ProgressLabel } from "@/components/ui/progress";

import { currencyRefreshMeter, type RefreshProgressView } from "../lib/currency-refresh-meter";
import type { CurrencyJob, CurrencySettingsRow } from "../types/currency";

const badgeVariant = (label: string) => {
  if (label === "Failed") {
    return "destructive" as const;
  }
  if (label === "Refreshing" || label === "Adding") {
    return "default" as const;
  }
  if (label === "Stale") {
    return "outline" as const;
  }
  return "secondary" as const;
};

export function CurrencyRefreshMeter({
  row,
  job,
  refreshProgress,
}: {
  row: CurrencySettingsRow;
  job: CurrencyJob | null;
  refreshProgress: RefreshProgressView | null;
}) {
  const model = currencyRefreshMeter({ row, job, refreshProgress });
  return (
    <Progress
      value={model.value}
      max={100}
      getAriaValueText={() => `${model.label} ${model.detail}`}
      className="w-full min-w-36 flex-col gap-1 data-indeterminate:[&_[data-slot=progress-indicator]]:w-1/3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ProgressLabel className="sr-only">{`${row.code} refresh`}</ProgressLabel>
          <Badge variant={badgeVariant(model.label)}>{model.label}</Badge>
        </div>
        <span className="truncate text-xs text-muted-foreground tabular-nums">{model.detail}</span>
      </div>
    </Progress>
  );
}
