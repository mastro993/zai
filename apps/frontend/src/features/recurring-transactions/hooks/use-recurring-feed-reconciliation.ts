import { Result } from "@praha/byethrow";
import { useCallback, useState } from "react";

import {
  getRecurringProcessingStatus,
  getRecurringTransactions,
} from "../commands/recurring-transactions";
import type { RecurringFeedItem, RecurringFeedResult } from "../types/recurring-transaction";
import {
  RecurringProcessingReconciliationError,
  useRecurringProcessingLiveEvents,
} from "./use-recurring-processing-live-events";

interface RecurringFeedSelectionPort {
  rememberRevisions: (items: Array<{ id: string; revision: number }>) => void;
}

interface UseRecurringFeedReconciliationProps {
  initialItems: Array<RecurringFeedItem>;
  initialNextCursor?: string | null;
  selection: RecurringFeedSelectionPort;
}

const feedRevisions = (items: Array<RecurringFeedItem>) =>
  items.map((item) => ({
    id: item.recurringTransaction.id,
    revision: item.recurringTransaction.revision,
  }));

export function useRecurringFeedReconciliation({
  initialItems,
  initialNextCursor,
  selection,
}: UseRecurringFeedReconciliationProps) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [feedError, setFeedError] = useState<string>();
  const [reconciliationError, setReconciliationError] = useState<string>();
  const [subscriptionError, setSubscriptionError] = useState(false);

  const applyFeed = useCallback(
    (feed: RecurringFeedResult) => {
      setItems(feed.items);
      setNextCursor(feed.nextCursor);
      selection.rememberRevisions(feedRevisions(feed.items));
    },
    [selection],
  );

  const appendFeed = useCallback(
    (feed: RecurringFeedResult) => {
      setItems((current) => [...current, ...feed.items]);
      setNextCursor(feed.nextCursor);
      selection.rememberRevisions(feedRevisions(feed.items));
    },
    [selection],
  );

  const refreshFeed = useCallback(async (): Promise<boolean> => {
    const result = await getRecurringTransactions();
    if (Result.isFailure(result)) {
      setFeedError(result.error.message);
      return false;
    }
    setFeedError(undefined);
    applyFeed(result.value);
    return true;
  }, [applyFeed]);

  const loadMoreFeed = useCallback(
    async (cursor: string): Promise<boolean> => {
      const result = await getRecurringTransactions(50, cursor);
      if (Result.isFailure(result)) {
        setFeedError(result.error.message);
        return false;
      }
      setFeedError(undefined);
      appendFeed(result.value);
      return true;
    },
    [appendFeed],
  );

  const reconcileFromDurableState = useCallback(async () => {
    const [statusResult, feedResult] = await Promise.all([
      getRecurringProcessingStatus(),
      getRecurringTransactions(),
    ]);
    const errors: Array<string> = [];

    if (Result.isFailure(statusResult)) {
      errors.push(`Processing status refresh failed: ${statusResult.error.message}`);
    }

    if (Result.isFailure(feedResult)) {
      errors.push(`Recurring feed refresh failed: ${feedResult.error.message}`);
    } else {
      applyFeed(feedResult.value);
      setFeedError(undefined);
    }

    if (errors.length > 0) {
      const message = errors.join(" ");
      setReconciliationError(message);
      return Result.fail(new RecurringProcessingReconciliationError(message));
    }

    setReconciliationError(undefined);
    return Result.succeed(undefined);
  }, [applyFeed]);

  const handleReconciliationFailure = useCallback(
    (error: RecurringProcessingReconciliationError) => {
      setReconciliationError(error.message);
    },
    [],
  );

  const handleSubscriptionFailure = useCallback(() => {
    setSubscriptionError(true);
  }, []);

  const handleSubscriptionRecovered = useCallback(() => {
    setSubscriptionError(false);
  }, []);

  const reportReconciliationError = useCallback((message: string) => {
    setReconciliationError(message);
  }, []);

  useRecurringProcessingLiveEvents({
    onReconcile: reconcileFromDurableState,
    onReady: reconcileFromDurableState,
    onReconciliationFailure: handleReconciliationFailure,
    onSubscriptionFailure: handleSubscriptionFailure,
    onSubscriptionRecovered: handleSubscriptionRecovered,
  });

  return {
    items,
    nextCursor,
    feedError,
    reconciliationError,
    subscriptionError,
    refreshFeed,
    loadMoreFeed,
    reportReconciliationError,
  };
}
