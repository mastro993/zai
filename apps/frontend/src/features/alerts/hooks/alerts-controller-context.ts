import { createContext, useContext, type RefObject } from "react";

import type { AlertSessionFilters, AlertSeverityFilter } from "../lib/session-filters";
import type { DomainAlert, DomainAlertReadState } from "../types/domain-alert";
import type { DestinationFeedback } from "./use-alert-destination";

export type AlertsRefreshStatus = "idle" | "loading" | "ready" | "error";
export type LoadOlderStatus = "idle" | "loading" | "error";

export interface AlertsControllerValue {
  bellRef: RefObject<HTMLButtonElement | null>;
  clearFilters: () => void;
  closeLedger: () => void;
  destinationFeedback: DestinationFeedback | null;
  errorMessage: string | null;
  filters: AlertSessionFilters;
  hasActiveFilters: boolean;
  isLedgerOpen: boolean;
  items: Array<DomainAlert>;
  lifecycleErrors: Record<string, string>;
  lifecyclePendingId: string | null;
  loadOlder: () => Promise<void>;
  loadOlderError: string | null;
  loadOlderStatus: LoadOlderStatus;
  markAllRead: () => Promise<void>;
  markAllReadError: string | null;
  markAllReadPending: boolean;
  nextCursor: string | null;
  openAlert: (alert: DomainAlert) => Promise<void>;
  openLedger: () => void;
  refresh: () => Promise<void>;
  refreshStatus: AlertsRefreshStatus;
  setReadStateFilter: (readState: DomainAlertReadState) => void;
  setSeverityFilter: (severity: AlertSeverityFilter) => void;
  toggleAlertReadState: (alert: DomainAlert) => Promise<void>;
  unreadCount: number;
  unreadCountKnown: boolean;
}

export const AlertsControllerContext = createContext<AlertsControllerValue | null>(null);

export const useAlertsController = (): AlertsControllerValue => {
  const context = useContext(AlertsControllerContext);
  if (!context) {
    throw new Error("useAlertsController must be used within AlertsControllerProvider.");
  }
  return context;
};
