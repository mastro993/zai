import { Result } from "@praha/byethrow";
import { useCallback, useRef, useState } from "react";

import {
  getRecurringProcessingStatus,
  getRecurringTransactions,
} from "../commands/recurring-transactions";
import type {
  RecurringFeedFilters,
  RecurringFeedItem,
  RecurringFeedResult,
} from "../types/recurring-transaction";
import {
  RecurringProcessingReconciliationError,
  useRecurringProcessingLiveEvents,
} from "./use-recurring-processing-live-events";

interface UseRecurringFeedReconciliationProps {
  initialItems: Array<RecurringFeedItem>;
  initialNextCursor?: string | null;
  filters: RecurringFeedFilters;
}

export function useRecurringFeedReconciliation({
  initialItems,
  initialNextCursor,
  filters,
}: UseRecurringFeedReconciliationProps) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [feedError, setFeedError] = useState<string>();
  const [reconciliationError, setReconciliationError] = useState<string>();
  const [subscriptionError, setSubscriptionError] = useState(false);
  const requestSequence = useRef(0);

  const applyFeed = useCallback((feed: RecurringFeedResult) => {
    setItems(feed.items);
    setNextCursor(feed.nextCursor);
  }, []);

  const appendFeed = useCallback((feed: RecurringFeedResult) => {
    setItems((current) => [...current, ...feed.items]);
    setNextCursor(feed.nextCursor);
  }, []);

  const refreshFeed = useCallback(
    async (requestedFilters: RecurringFeedFilters = filters): Promise<boolean> => {
      const requestId = ++requestSequence.current;
      const result = await getRecurringTransactions(50, undefined, requestedFilters);
      if (requestId !== requestSequence.current) {
        return true;
      }
      if (Result.isFailure(result)) {
        setFeedError(result.error.message);
        return false;
      }
      setFeedError(undefined);
      applyFeed(result.value);
      return true;
    },
    [applyFeed, filters],
  );

  const loadMoreFeed = useCallback(
    async (cursor: string): Promise<boolean> => {
      const requestId = ++requestSequence.current;
      const result = await getRecurringTransactions(50, cursor, filters);
      if (requestId !== requestSequence.current) {
        return true;
      }
      if (Result.isFailure(result)) {
        setFeedError(result.error.message);
        return false;
      }
      setFeedError(undefined);
      appendFeed(result.value);
      return true;
    },
    [appendFeed, filters],
  );

  const reconcileFromDurableState = useCallback(async () => {
    const requestId = ++requestSequence.current;
    const [statusResult, feedResult] = await Promise.all([
      getRecurringProcessingStatus(),
      getRecurringTransactions(50, undefined, filters),
    ]);
    if (requestId !== requestSequence.current) {
      return Result.succeed(undefined);
    }
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
  }, [applyFeed, filters]);

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
