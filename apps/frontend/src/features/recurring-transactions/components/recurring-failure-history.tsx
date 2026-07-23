import { Result } from "@praha/byethrow";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { getRecurringTransactionFailureHistory } from "../commands/recurring-transactions";
import { formatLocalDateTime } from "../lib/recurring";
import {
  recurringFailureCauseLabel,
  recurringFailureResolutionLabel,
} from "./recurring-failure-labels";
import type { RecurringFailurePage, RecurringGenerationFailure } from "../types/recurring-failure";

export function RecurringFailureHistory({
  recurringTransactionId,
  initialPage,
}: {
  recurringTransactionId: string;
  initialPage: RecurringFailurePage;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const regionId = useId();

  useEffect(() => {
    setItems(initialPage.items);
    setNextCursor(initialPage.nextCursor);
  }, [initialPage.items, initialPage.nextCursor]);

  if (items.length === 0 && !nextCursor) {
    return null;
  }

  const loadMore = async () => {
    if (!nextCursor || isLoading) {
      return;
    }
    setIsLoading(true);
    const result = await getRecurringTransactionFailureHistory(
      recurringTransactionId,
      20,
      nextCursor,
    );
    setIsLoading(false);
    if (Result.isFailure(result)) {
      toast.error(result.error.message);
      return;
    }
    setItems((current) => [...current, ...result.value.items]);
    setNextCursor(result.value.nextCursor);
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        aria-expanded={isOpen}
        aria-controls={regionId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? "Hide resolved failure history" : "Show resolved failure history"}
      </Button>
      {isOpen ? (
        <div
          id={regionId}
          role="region"
          aria-label="Resolved failure history"
          aria-busy={isLoading}
          className="space-y-2 border-t border-border pt-3"
        >
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resolved failures yet.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <FailureHistoryItem key={historyItemKey(item)} item={item} />
              ))}
            </ul>
          )}
          {nextCursor ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadMore()}
            >
              {isLoading ? "Loading…" : "Load more resolved failures"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function historyItemKey(item: RecurringGenerationFailure): string {
  return `${item.scheduleRevisionId}:${item.ordinal}:${item.firstFailedAt}`;
}

function FailureHistoryItem({ item }: { item: RecurringGenerationFailure }) {
  return (
    <li className="text-sm">
      <p>
        {recurringFailureCauseLabel(item.causeCategory)} ·{" "}
        {formatLocalDateTime(item.failedScheduledLocal)}
      </p>
      <p className="text-muted-foreground">
        {recurringFailureResolutionLabel(item.resolutionKind)} · Failed{" "}
        {formatLocalDateTime(item.firstFailedAt)}
        {item.resolvedAt ? ` · ${formatLocalDateTime(item.resolvedAt)}` : null}
      </p>
    </li>
  );
}
