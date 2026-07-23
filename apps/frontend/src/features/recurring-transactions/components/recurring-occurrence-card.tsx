import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import {
  formatFiniteProgress,
  formatLocalDateTime,
  progressRatio,
  recurringLifecycleLabel,
} from "../lib/recurring";
import type { RecurringFeedItem } from "../types/recurring-transaction";

export function RecurringOccurrenceCard({
  item,
  selected = false,
  disabled = false,
  onSelectedChange,
}: {
  item: RecurringFeedItem;
  selected?: boolean;
  disabled?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}) {
  const { recurringTransaction, description, nextScheduledLocal, needsAttention } = item;
  const progress = progressRatio(
    recurringTransaction.fulfilledCount,
    recurringTransaction.totalOccurrences,
  );
  const progressLabel = formatFiniteProgress(
    recurringTransaction.fulfilledCount,
    recurringTransaction.totalOccurrences,
  );

  return (
    <article
      className="border-b border-border py-4 last:border-b-0"
      aria-label={`${description}, ${recurringLifecycleLabel[recurringTransaction.lifecycle]}`}
    >
      <div className="flex items-start gap-3">
        {onSelectedChange ? (
          <Checkbox
            checked={selected}
            disabled={disabled}
            onCheckedChange={(value) => onSelectedChange(value === true)}
            aria-label={`Select ${description}`}
            className="mt-1"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="truncate text-base font-medium underline-offset-3 hover:underline"
                to="/cash-flow/recurring/$recurringTransactionId"
                params={{ recurringTransactionId: recurringTransaction.id }}
              >
                {description}
              </Link>
              <Badge
                variant={recurringTransaction.lifecycle === "active" ? "default" : "secondary"}
              >
                {recurringLifecycleLabel[recurringTransaction.lifecycle]}
              </Badge>
              {needsAttention ? (
                <Badge variant="destructive" className="inline-flex items-center gap-1">
                  <HugeiconsIcon
                    icon={Alert02Icon}
                    strokeWidth={2}
                    className="size-3.5"
                    aria-hidden
                  />
                  Needs attention
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Next occurrence {formatLocalDateTime(nextScheduledLocal)}
            </p>
            {progressLabel ? (
              <p className="text-sm" aria-label={`Progress ${progressLabel}`}>
                Progress: {progressLabel}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Indefinite schedule</p>
            )}
          </div>
          {progress !== undefined ? (
            <div
              className="relative size-12 shrink-0"
              role="img"
              aria-label={`Finite progress ${Math.round(progress * 100)} percent`}
            >
              <svg viewBox="0 0 36 36" className="size-12 -rotate-90" aria-hidden="true">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  className="stroke-muted"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  className="stroke-foreground"
                  strokeWidth="3"
                  strokeDasharray={`${progress * 94.2} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
