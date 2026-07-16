import { Result } from "@praha/byethrow";
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import { markAllAlertsRead, markAlertRead, markAlertUnread } from "../commands/alerts";
import { isUnreadAlert, parseDomainAlert } from "../lib/parse";
import type { DomainAlert } from "../types/domain-alert";
import type { RefreshOptions } from "./use-alerts-list";

interface UseAlertsLifecycleOptions {
  refresh: (options?: RefreshOptions) => Promise<void>;
  setItems: Dispatch<SetStateAction<Array<DomainAlert>>>;
  setUnreadCount: Dispatch<SetStateAction<number>>;
  unreadCount: number;
  unreadCountKnown: boolean;
}

export function useAlertsLifecycle({
  refresh,
  setItems,
  setUnreadCount,
  unreadCount,
  unreadCountKnown,
}: UseAlertsLifecycleOptions) {
  const [lifecycleErrors, setLifecycleErrors] = useState<Record<string, string>>({});
  const [lifecyclePendingId, setLifecyclePendingId] = useState<string | null>(null);
  const [markAllReadError, setMarkAllReadError] = useState<string | null>(null);
  const [markAllReadPending, setMarkAllReadPending] = useState(false);

  const syncAlertUpdate = useCallback(
    (previous: DomainAlert, updated: DomainAlert) => {
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      const wasUnread = isUnreadAlert(previous);
      const nowUnread = isUnreadAlert(updated);
      if (wasUnread && !nowUnread) {
        setUnreadCount((count) => Math.max(0, count - 1));
      } else if (!wasUnread && nowUnread) {
        setUnreadCount((count) => count + 1);
      }
    },
    [setItems, setUnreadCount],
  );

  const applyLifecycleResult = useCallback(
    (previous: DomainAlert, result: Awaited<ReturnType<typeof markAlertRead>>) => {
      if (Result.isFailure(result)) {
        setLifecycleErrors((current) => ({
          ...current,
          [previous.id]: result.error.message,
        }));
        return null;
      }

      const updated = parseDomainAlert(result.value);
      if (!updated) {
        setLifecycleErrors((current) => ({
          ...current,
          [previous.id]: "Saved alerts could not be read.",
        }));
        return null;
      }

      setLifecycleErrors((current) => {
        if (!(previous.id in current)) {
          return current;
        }
        const next = { ...current };
        delete next[previous.id];
        return next;
      });
      syncAlertUpdate(previous, updated);
      return updated;
    },
    [syncAlertUpdate],
  );

  const toggleAlertReadState = useCallback(
    async (alert: DomainAlert) => {
      setLifecyclePendingId(alert.id);
      const result = isUnreadAlert(alert)
        ? await markAlertRead(alert.id)
        : await markAlertUnread(alert.id);
      const updated = applyLifecycleResult(alert, result);
      if (updated) {
        await refresh({ preserveItems: true });
      }
      setLifecyclePendingId(null);
    },
    [applyLifecycleResult, refresh],
  );

  const markAllRead = useCallback(async () => {
    if (markAllReadPending || !unreadCountKnown || unreadCount === 0) {
      return;
    }

    setMarkAllReadPending(true);
    setMarkAllReadError(null);
    const result = await markAllAlertsRead();

    if (Result.isFailure(result)) {
      setMarkAllReadError(result.error.message);
      setMarkAllReadPending(false);
      return;
    }

    const markedAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        isUnreadAlert(item) ? { ...item, readAt: item.readAt ?? markedAt } : item,
      ),
    );
    await refresh({ preserveItems: true });
    setMarkAllReadPending(false);
  }, [markAllReadPending, refresh, setItems, unreadCount, unreadCountKnown]);

  return {
    applyLifecycleResult,
    lifecycleErrors,
    lifecyclePendingId,
    markAllRead,
    markAllReadError,
    markAllReadPending,
    setLifecyclePendingId,
    toggleAlertReadState,
  };
}
