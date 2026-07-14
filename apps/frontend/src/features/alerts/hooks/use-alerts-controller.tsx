import { Result } from "@praha/byethrow";
import { useNavigate } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { getBudget } from "@/features/cash-flow/commands/budgets";

import {
  getUnreadAlertCount,
  listAlerts,
  markAlertRead,
  markAlertUnread,
} from "../commands/alerts";
import {
  isNavigableAlertDestination,
  isUnreadAlert,
  parseDomainAlert,
  parseDomainAlertListPage,
} from "../lib/parse";
import type { DomainAlert } from "../types/domain-alert";

type AlertsRefreshStatus = "idle" | "loading" | "ready" | "error";

interface DestinationFeedback {
  alertId: string;
  message: string;
}

interface AlertsControllerValue {
  bellRef: RefObject<HTMLButtonElement | null>;
  closeLedger: () => void;
  destinationFeedback: DestinationFeedback | null;
  errorMessage: string | null;
  isLedgerOpen: boolean;
  items: Array<DomainAlert>;
  lifecycleErrors: Record<string, string>;
  lifecyclePendingId: string | null;
  openAlert: (alert: DomainAlert) => Promise<void>;
  openLedger: () => void;
  refresh: () => Promise<void>;
  refreshStatus: AlertsRefreshStatus;
  toggleAlertReadState: (alert: DomainAlert) => Promise<void>;
  unreadCount: number;
}

const AlertsControllerContext = createContext<AlertsControllerValue | null>(null);

const STALE_BUDGET_MESSAGE = "This budget is no longer available. The alert history is unchanged.";

export function AlertsControllerProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const bellRef = useRef<HTMLButtonElement>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [items, setItems] = useState<Array<DomainAlert>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshStatus, setRefreshStatus] = useState<AlertsRefreshStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lifecycleErrors, setLifecycleErrors] = useState<Record<string, string>>({});
  const [lifecyclePendingId, setLifecyclePendingId] = useState<string | null>(null);
  const [destinationFeedback, setDestinationFeedback] = useState<DestinationFeedback | null>(null);

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

  const refresh = useCallback(async () => {
    setRefreshStatus((status) => (status === "idle" ? "loading" : status));
    const [listResult, countResult] = await Promise.all([listAlerts(), getUnreadAlertCount()]);

    if (Result.isFailure(listResult)) {
      setRefreshStatus("error");
      setErrorMessage(listResult.error.message);
      return;
    }

    const parsedPage = parseDomainAlertListPage(listResult.value);
    if (!parsedPage) {
      setRefreshStatus("error");
      setErrorMessage("Saved alerts could not be read.");
      return;
    }

    setItems(parsedPage.items);
    setRefreshStatus("ready");
    setErrorMessage(null);

    if (Result.isSuccess(countResult)) {
      setUnreadCount(countResult.value);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openLedger = useCallback(() => {
    setIsLedgerOpen(true);
    setDestinationFeedback(null);
    void refresh();
  }, [refresh]);

  const closeLedger = useCallback(() => {
    setIsLedgerOpen(false);
    setDestinationFeedback(null);
    bellRef.current?.focus();
  }, []);

  const toggleAlertReadState = useCallback(
    async (alert: DomainAlert) => {
      setLifecyclePendingId(alert.id);
      const result = isUnreadAlert(alert)
        ? await markAlertRead(alert.id)
        : await markAlertUnread(alert.id);
      applyLifecycleResult(alert, result);
      setLifecyclePendingId(null);
    },
    [applyLifecycleResult],
  );

  const openAlert = useCallback(
    async (alert: DomainAlert) => {
      setDestinationFeedback(null);
      let current = alert;

      if (isUnreadAlert(alert)) {
        setLifecyclePendingId(alert.id);
        const result = await markAlertRead(alert.id);
        const updated = applyLifecycleResult(alert, result);
        setLifecyclePendingId(null);
        if (!updated) {
          return;
        }
        current = updated;
      }

      if (!isNavigableAlertDestination(current.destination)) {
        return;
      }

      const budgetResult = await getBudget(current.destination.budgetId);
      if (Result.isFailure(budgetResult)) {
        setDestinationFeedback({
          alertId: current.id,
          message: STALE_BUDGET_MESSAGE,
        });
        return;
      }

      closeLedger();
      await navigate({
        to: "/cash-flow/budgets/$budgetId",
        params: { budgetId: current.destination.budgetId },
      });
    },
    [applyLifecycleResult, closeLedger, navigate],
  );

  const value = useMemo(
    () => ({
      bellRef,
      closeLedger,
      destinationFeedback,
      errorMessage,
      isLedgerOpen,
      items,
      lifecycleErrors,
      lifecyclePendingId,
      openAlert,
      openLedger,
      refresh,
      refreshStatus,
      toggleAlertReadState,
      unreadCount,
    }),
    [
      closeLedger,
      destinationFeedback,
      errorMessage,
      isLedgerOpen,
      items,
      lifecycleErrors,
      lifecyclePendingId,
      openAlert,
      openLedger,
      refresh,
      refreshStatus,
      toggleAlertReadState,
      unreadCount,
    ],
  );

  return (
    <AlertsControllerContext.Provider value={value}>{children}</AlertsControllerContext.Provider>
  );
}

export const useAlertsController = (): AlertsControllerValue => {
  const context = useContext(AlertsControllerContext);
  if (!context) {
    throw new Error("useAlertsController must be used within AlertsControllerProvider.");
  }
  return context;
};
