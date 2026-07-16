import { useCallback, useMemo, type ReactNode } from "react";

import type { DomainAlert } from "../types/domain-alert";
import { AlertsControllerContext } from "./alerts-controller-context";
import { useAlertDestination } from "./use-alert-destination";
import { useAlertsLedger } from "./use-alerts-ledger";
import { useAlertsLifecycle } from "./use-alerts-lifecycle";
import { useAlertsList } from "./use-alerts-list";
import { useAlertsLiveEvents } from "./use-alerts-live-events";

export function AlertsControllerProvider({ children }: { children: ReactNode }) {
  const list = useAlertsList();
  const ledger = useAlertsLedger({ refresh: list.refresh });
  const { createActivateAlertFromToastHandler } = ledger;
  const lifecycle = useAlertsLifecycle({
    refresh: list.refresh,
    setItems: list.setItems,
    setUnreadCount: list.setUnreadCount,
    unreadCount: list.unreadCount,
    unreadCountKnown: list.unreadCountKnown,
  });

  const openAlert = useAlertDestination({
    applyLifecycleResult: lifecycle.applyLifecycleResult,
    closeLedger: ledger.closeLedger,
    refresh: list.refreshPreservingItems,
    setDestinationFeedback: ledger.setDestinationFeedback,
    setLifecyclePendingId: lifecycle.setLifecyclePendingId,
  });

  const activateAlertFromToastHandler = useCallback(
    (alert: DomainAlert) => createActivateAlertFromToastHandler(openAlert)(alert),
    [createActivateAlertFromToastHandler, openAlert],
  );

  useAlertsLiveEvents({
    onActivateAlert: activateAlertFromToastHandler,
    onReconcile: list.reconcileLiveState,
    onReady: list.loadInitialState,
  });

  const value = useMemo(
    () => ({
      bellRef: ledger.bellRef,
      clearFilters: list.clearFilters,
      closeLedger: ledger.closeLedger,
      destinationFeedback: ledger.destinationFeedback,
      errorMessage: list.errorMessage,
      filters: list.filters,
      hasActiveFilters: list.hasActiveFilters,
      isLedgerOpen: ledger.isLedgerOpen,
      ledgerFocusAlertId: ledger.ledgerFocusAlertId,
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
      openLedger: ledger.openLedger,
      refresh: list.refresh,
      refreshStatus: list.refreshStatus,
      setReadStateFilter: list.setReadStateFilter,
      setSeverityFilter: list.setSeverityFilter,
      toggleAlertReadState: lifecycle.toggleAlertReadState,
      unreadCount: list.unreadCount,
      unreadCountKnown: list.unreadCountKnown,
    }),
    [
      ledger.bellRef,
      ledger.closeLedger,
      ledger.destinationFeedback,
      ledger.isLedgerOpen,
      ledger.ledgerFocusAlertId,
      ledger.openLedger,
      list.clearFilters,
      list.errorMessage,
      list.filters,
      list.hasActiveFilters,
      list.items,
      list.loadOlder,
      list.loadOlderError,
      list.loadOlderStatus,
      list.nextCursor,
      list.refresh,
      list.refreshStatus,
      list.setReadStateFilter,
      list.setSeverityFilter,
      list.unreadCount,
      list.unreadCountKnown,
      lifecycle.lifecycleErrors,
      lifecycle.lifecyclePendingId,
      lifecycle.markAllRead,
      lifecycle.markAllReadError,
      lifecycle.markAllReadPending,
      lifecycle.toggleAlertReadState,
      openAlert,
    ],
  );

  return (
    <AlertsControllerContext.Provider value={value}>{children}</AlertsControllerContext.Provider>
  );
}

export { useAlertsController } from "./alerts-controller-context";
