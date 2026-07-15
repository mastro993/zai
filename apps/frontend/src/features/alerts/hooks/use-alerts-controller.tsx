import { Result } from "@praha/byethrow";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { listAlerts, markAllAlertsRead, markAlertRead, markAlertUnread } from "../commands/alerts";
import { buildListAlertsQuery } from "../lib/build-list-query";
import { activateAlertFromToast } from "../lib/activate-alert-from-toast";
import { mergeReconciledAlertPage } from "../lib/merge-page";
import { isUnreadAlert, parseDomainAlert, parseDomainAlertListPage } from "../lib/parse";
import {
  getAlertSessionFilters,
  hasActiveAlertFilters,
  setAlertSessionFilters,
  type AlertSessionFilters,
  type AlertSeverityFilter,
} from "../lib/session-filters";
import type { DomainAlert, DomainAlertReadState } from "../types/domain-alert";
import {
  AlertsControllerContext,
  type AlertsRefreshStatus,
  type LoadOlderStatus,
} from "./alerts-controller-context";
import { fetchUnreadCount } from "./alerts-controller-queries";
import { type DestinationFeedback, useAlertDestination } from "./use-alert-destination";
import { useAlertsLiveEvents } from "./use-alerts-live-events";

interface RefreshOptions {
  preserveItems?: boolean;
}

export function AlertsControllerProvider({ children }: { children: ReactNode }) {
  const bellRef = useRef<HTMLButtonElement>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [ledgerFocusAlertId, setLedgerFocusAlertId] = useState<string | null>(null);
  const [filters, setFilters] = useState<AlertSessionFilters>(getAlertSessionFilters);
  const filtersRef = useRef(filters);
  const listRequestIdRef = useRef(0);
  const [items, setItems] = useState<Array<DomainAlert>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadCountKnown, setUnreadCountKnown] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<AlertsRefreshStatus>("idle");
  const [loadOlderStatus, setLoadOlderStatus] = useState<LoadOlderStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadOlderError, setLoadOlderError] = useState<string | null>(null);
  const [lifecycleErrors, setLifecycleErrors] = useState<Record<string, string>>({});
  const [lifecyclePendingId, setLifecyclePendingId] = useState<string | null>(null);
  const [markAllReadError, setMarkAllReadError] = useState<string | null>(null);
  const [markAllReadPending, setMarkAllReadPending] = useState(false);
  const [destinationFeedback, setDestinationFeedback] = useState<DestinationFeedback | null>(null);

  const applyUnreadCount = useCallback((count: number | null) => {
    if (count === null) {
      setUnreadCountKnown(false);
      return;
    }

    setUnreadCount(count);
    setUnreadCountKnown(true);
  }, []);

  const fetchPage = useCallback(async (queryFilters: AlertSessionFilters, cursor?: string) => {
    return listAlerts(buildListAlertsQuery(queryFilters, cursor ? { cursor } : {}));
  }, []);

  const syncAlertUpdate = useCallback((previous: DomainAlert, updated: DomainAlert) => {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    const wasUnread = isUnreadAlert(previous);
    const nowUnread = isUnreadAlert(updated);
    if (wasUnread && !nowUnread) {
      setUnreadCount((count) => Math.max(0, count - 1));
    } else if (!wasUnread && nowUnread) {
      setUnreadCount((count) => count + 1);
    }
  }, []);

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

  const applyListPage = useCallback(
    (
      requestId: number,
      parsedPage: NonNullable<ReturnType<typeof parseDomainAlertListPage>>,
      preserveItems: boolean,
      activeFilters: AlertSessionFilters,
    ) => {
      if (requestId !== listRequestIdRef.current) {
        return;
      }

      setItems((current) =>
        preserveItems
          ? mergeReconciledAlertPage(current, parsedPage, activeFilters)
          : parsedPage.items,
      );
      setNextCursor(parsedPage.nextCursor ?? null);
      setRefreshStatus("ready");
      setErrorMessage(null);
      setLoadOlderStatus("idle");
      setLoadOlderError(null);
    },
    [],
  );

  const refresh = useCallback(
    async (options: RefreshOptions = {}) => {
      const requestId = ++listRequestIdRef.current;
      setRefreshStatus((status) => (status === "idle" ? "loading" : status));
      const activeFilters = filtersRef.current;
      const [listResult, count] = await Promise.all([fetchPage(activeFilters), fetchUnreadCount()]);

      if (requestId !== listRequestIdRef.current) {
        return;
      }

      applyUnreadCount(count);
      if (Result.isFailure(listResult)) {
        setRefreshStatus("error");
        setErrorMessage(listResult.error.message);
        return;
      }

      if (count === null) {
        setRefreshStatus("error");
        setErrorMessage("Saved alert count could not be read.");
        return;
      }
      const parsedPage = parseDomainAlertListPage(listResult.value);
      if (!parsedPage) {
        setRefreshStatus("error");
        setErrorMessage("Saved alerts could not be read.");
        return;
      }

      applyListPage(requestId, parsedPage, options.preserveItems === true, activeFilters);
    },
    [applyListPage, applyUnreadCount, fetchPage],
  );

  const applyFilters = useCallback(
    async (nextFilters: AlertSessionFilters) => {
      const requestId = ++listRequestIdRef.current;
      setAlertSessionFilters(nextFilters);
      setFilters(nextFilters);
      filtersRef.current = nextFilters;
      setRefreshStatus((status) => (status === "idle" ? "loading" : status));

      const [listResult, count] = await Promise.all([fetchPage(nextFilters), fetchUnreadCount()]);

      if (requestId !== listRequestIdRef.current) {
        return;
      }

      applyUnreadCount(count);
      if (Result.isFailure(listResult)) {
        setRefreshStatus("error");
        setErrorMessage(listResult.error.message);
        return;
      }

      if (count === null) {
        setRefreshStatus("error");
        setErrorMessage("Saved alert count could not be read.");
        return;
      }
      const parsedPage = parseDomainAlertListPage(listResult.value);
      if (!parsedPage) {
        setRefreshStatus("error");
        setErrorMessage("Saved alerts could not be read.");
        return;
      }

      applyListPage(requestId, parsedPage, false, nextFilters);
    },
    [applyListPage, applyUnreadCount, fetchPage],
  );

  const setReadStateFilter = useCallback(
    (readState: DomainAlertReadState) => {
      const currentFilters = filtersRef.current;
      if (readState === currentFilters.readState) {
        return;
      }
      void applyFilters({ ...currentFilters, readState });
    },
    [applyFilters],
  );

  const setSeverityFilter = useCallback(
    (severity: AlertSeverityFilter) => {
      const currentFilters = filtersRef.current;
      if (severity === currentFilters.severity) {
        return;
      }
      void applyFilters({ ...currentFilters, severity });
    },
    [applyFilters],
  );

  const clearFilters = useCallback(() => {
    void applyFilters({ readState: "all", severity: "all" });
  }, [applyFilters]);

  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadOlderStatus === "loading") {
      return;
    }

    setLoadOlderStatus("loading");
    setLoadOlderError(null);
    const requestId = listRequestIdRef.current;

    const listResult = await fetchPage(filtersRef.current, nextCursor);
    if (requestId !== listRequestIdRef.current) {
      setLoadOlderStatus("idle");
      return;
    }
    if (Result.isFailure(listResult)) {
      setLoadOlderStatus("error");
      setLoadOlderError(listResult.error.message);
      return;
    }

    const parsedPage = parseDomainAlertListPage(listResult.value);
    if (!parsedPage) {
      setLoadOlderStatus("error");
      setLoadOlderError("Saved alerts could not be read.");
      return;
    }

    setItems((current) => mergeReconciledAlertPage(current, parsedPage, filtersRef.current));
    setNextCursor(parsedPage.nextCursor ?? null);
    setLoadOlderStatus("idle");
  }, [fetchPage, loadOlderStatus, nextCursor]);

  const openLedger = useCallback(() => {
    setIsLedgerOpen(true);
    setLedgerFocusAlertId(null);
    setDestinationFeedback(null);
    void refresh({ preserveItems: true });
  }, [refresh]);

  const reconcileLiveState = useCallback(() => {
    void refresh({ preserveItems: true });
  }, [refresh]);

  const loadInitialState = useCallback(() => {
    void refresh();
  }, [refresh]);

  const refreshPreservingItems = useCallback(() => refresh({ preserveItems: true }), [refresh]);

  const closeLedger = useCallback(() => {
    setIsLedgerOpen(false);
    setLedgerFocusAlertId(null);
    setDestinationFeedback(null);
    bellRef.current?.focus();
  }, []);

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
  }, [markAllReadPending, refresh, unreadCount, unreadCountKnown]);

  const openAlert = useAlertDestination({
    applyLifecycleResult,
    closeLedger,
    refresh: refreshPreservingItems,
    setDestinationFeedback,
    setLifecyclePendingId,
  });

  const activateAlertFromToastHandler = useCallback(
    async (alert: DomainAlert) =>
      activateAlertFromToast(alert, {
        openAlert,
        refresh,
        setDestinationFeedback,
        setIsLedgerOpen,
        setLedgerFocusAlertId,
      }),
    [openAlert, refresh],
  );

  useAlertsLiveEvents({
    onActivateAlert: activateAlertFromToastHandler,
    onReconcile: reconcileLiveState,
    onReady: loadInitialState,
  });

  const hasActiveFilters = hasActiveAlertFilters(filters);

  const value = useMemo(
    () => ({
      bellRef,
      clearFilters,
      closeLedger,
      destinationFeedback,
      errorMessage,
      filters,
      hasActiveFilters,
      isLedgerOpen,
      ledgerFocusAlertId,
      items,
      lifecycleErrors,
      lifecyclePendingId,
      loadOlder,
      loadOlderError,
      loadOlderStatus,
      markAllRead,
      markAllReadError,
      markAllReadPending,
      nextCursor,
      openAlert,
      openLedger,
      refresh,
      refreshStatus,
      setReadStateFilter,
      setSeverityFilter,
      toggleAlertReadState,
      unreadCount,
      unreadCountKnown,
    }),
    [
      clearFilters,
      closeLedger,
      destinationFeedback,
      errorMessage,
      filters,
      hasActiveFilters,
      isLedgerOpen,
      ledgerFocusAlertId,
      items,
      lifecycleErrors,
      lifecyclePendingId,
      loadOlder,
      loadOlderError,
      loadOlderStatus,
      markAllRead,
      markAllReadError,
      markAllReadPending,
      nextCursor,
      openAlert,
      openLedger,
      refresh,
      refreshStatus,
      setReadStateFilter,
      setSeverityFilter,
      toggleAlertReadState,
      unreadCount,
      unreadCountKnown,
    ],
  );

  return (
    <AlertsControllerContext.Provider value={value}>{children}</AlertsControllerContext.Provider>
  );
}

export { useAlertsController } from "./alerts-controller-context";
