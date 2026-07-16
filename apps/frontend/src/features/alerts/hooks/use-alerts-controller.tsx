import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { activateAlertFromToast } from "../lib/activate-alert-from-toast";
import { hasActiveAlertFilters } from "../lib/session-filters";
import type { DomainAlert } from "../types/domain-alert";
import { AlertsControllerContext } from "./alerts-controller-context";
import { useAlertDestination, type DestinationFeedback } from "./use-alert-destination";
import { useAlertLifecycleActions } from "./use-alert-lifecycle-actions";
import { useAlertListController } from "./use-alert-list-controller";
import { useAlertsLiveEvents } from "./use-alerts-live-events";

export function AlertsControllerProvider({ children }: { children: ReactNode }) {
  const bellRef = useRef<HTMLButtonElement>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [ledgerFocusAlertId, setLedgerFocusAlertId] = useState<string | null>(null);
  const [destinationFeedback, setDestinationFeedback] = useState<DestinationFeedback | null>(null);
  const list = useAlertListController();
  const lifecycle = useAlertLifecycleActions(list);
  const { refresh } = list;

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

  const openAlert = useAlertDestination({
    applyLifecycleResult: lifecycle.applyLifecycleResult,
    closeLedger,
    refresh: refreshPreservingItems,
    setDestinationFeedback,
    setLifecyclePendingId: lifecycle.setLifecyclePendingId,
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

  const hasActiveFilters = hasActiveAlertFilters(list.filters);
  const value = useMemo(
    () => ({
      bellRef,
      clearFilters: list.clearFilters,
      closeLedger,
      destinationFeedback,
      errorMessage: list.errorMessage,
      filters: list.filters,
      hasActiveFilters,
      isLedgerOpen,
      ledgerFocusAlertId,
      items: list.items,
      lifecycleErrors: lifecycle.lifecycleErrors,
      lifecyclePendingId: lifecycle.lifecyclePendingId,
      loadOlder: list.loadOlder,
      loadOlderError: list.loadOlderError,
      loadOlderStatus: list.loadOlderStatus,
      markAllRead: lifecycle.markAllRead,
      markAllReadError: lifecycle.markAllReadError,
      markAllReadPending: lifecycle.markAllReadPending,
      nextCursor: list.nextCursor,
      openAlert,
      openLedger,
      refresh,
      refreshStatus: list.refreshStatus,
      setReadStateFilter: list.setReadStateFilter,
      setSeverityFilter: list.setSeverityFilter,
      toggleAlertReadState: lifecycle.toggleAlertReadState,
      unreadCount: list.unreadCount,
      unreadCountKnown: list.unreadCountKnown,
    }),
    [
      closeLedger,
      destinationFeedback,
      hasActiveFilters,
      isLedgerOpen,
      ledgerFocusAlertId,
      lifecycle.lifecycleErrors,
      lifecycle.lifecyclePendingId,
      lifecycle.markAllRead,
      lifecycle.markAllReadError,
      lifecycle.markAllReadPending,
      lifecycle.toggleAlertReadState,
      list.clearFilters,
      list.errorMessage,
      list.filters,
      list.items,
      list.loadOlder,
      list.loadOlderError,
      list.loadOlderStatus,
      list.nextCursor,
      list.refreshStatus,
      list.setReadStateFilter,
      list.setSeverityFilter,
      list.unreadCount,
      list.unreadCountKnown,
      openAlert,
      openLedger,
      refresh,
    ],
  );

  return (
    <AlertsControllerContext.Provider value={value}>{children}</AlertsControllerContext.Provider>
  );
}

export { useAlertsController } from "./alerts-controller-context";
