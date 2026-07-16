import { Result } from "@praha/byethrow";
import { useCallback, useState } from "react";

import { markAllAlertsRead, markAlertRead, markAlertUnread } from "../commands/alerts";
import { isUnreadAlert, parseDomainAlert } from "../lib/parse";
import type { DomainAlert } from "../types/domain-alert";
import type { AlertListController } from "./use-alert-list-controller";

export function useAlertLifecycleActions(list: AlertListController) {
  const [lifecycleErrors, setLifecycleErrors] = useState<Record<string, string>>({});
  const [lifecyclePendingId, setLifecyclePendingId] = useState<string | null>(null);
  const [markAllReadError, setMarkAllReadError] = useState<string | null>(null);
  const [markAllReadPending, setMarkAllReadPending] = useState(false);
  const { refresh, setItems, syncAlertUpdate } = list;

  const applyLifecycleResult = useCallback(
    (previous: DomainAlert, result: Awaited<ReturnType<typeof markAlertRead>>) => {
      if (Result.isFailure(result)) {
        setLifecycleErrors((current) => ({ ...current, [previous.id]: result.error.message }));
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
    if (markAllReadPending || !list.unreadCountKnown || list.unreadCount === 0) {
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
  }, [list.unreadCount, list.unreadCountKnown, markAllReadPending, refresh, setItems]);

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
