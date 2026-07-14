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
import { buildListAlertsQuery } from "../lib/build-list-query";
import {
  isNavigableAlertDestination,
  isUnreadAlert,
  parseDomainAlert,
  parseDomainAlertListPage,
} from "../lib/parse";
import {
  getAlertSessionFilters,
  hasActiveAlertFilters,
  setAlertSessionFilters,
  type AlertSessionFilters,
  type AlertSeverityFilter,
} from "../lib/session-filters";
import type { DomainAlert, DomainAlertReadState } from "../types/domain-alert";

type AlertsRefreshStatus = "idle" | "loading" | "ready" | "error";
type LoadOlderStatus = "idle" | "loading" | "error";

interface DestinationFeedback {
  alertId: string;
  message: string;
}

interface AlertsControllerValue {
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
  nextCursor: string | null;
  openAlert: (alert: DomainAlert) => Promise<void>;
  openLedger: () => void;
  refresh: () => Promise<void>;
  refreshStatus: AlertsRefreshStatus;
  setReadStateFilter: (readState: DomainAlertReadState) => void;
  setSeverityFilter: (severity: AlertSeverityFilter) => void;
  toggleAlertReadState: (alert: DomainAlert) => Promise<void>;
  unreadCount: number;
}

const AlertsControllerContext = createContext<AlertsControllerValue | null>(null);

const STALE_BUDGET_MESSAGE = "This budget is no longer available. The alert history is unchanged.";

const fetchUnreadCount = async (): Promise<number | null> => {
  const countResult = await getUnreadAlertCount();
  return Result.isSuccess(countResult) ? countResult.value : null;
};

export function AlertsControllerProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const bellRef = useRef<HTMLButtonElement>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [filters, setFilters] = useState<AlertSessionFilters>(getAlertSessionFilters);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const listRequestIdRef = useRef(0);
  const [items, setItems] = useState<Array<DomainAlert>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshStatus, setRefreshStatus] = useState<AlertsRefreshStatus>("idle");
  const [loadOlderStatus, setLoadOlderStatus] = useState<LoadOlderStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadOlderError, setLoadOlderError] = useState<string | null>(null);
  const [lifecycleErrors, setLifecycleErrors] = useState<Record<string, string>>({});
  const [lifecyclePendingId, setLifecyclePendingId] = useState<string | null>(null);
  const [destinationFeedback, setDestinationFeedback] = useState<DestinationFeedback | null>(null);

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
      count: number | null,
    ) => {
      if (requestId !== listRequestIdRef.current) {
        return;
      }

      setItems(parsedPage.items);
      setNextCursor(parsedPage.nextCursor ?? null);
      setRefreshStatus("ready");
      setErrorMessage(null);
      setLoadOlderStatus("idle");
      setLoadOlderError(null);

      if (count !== null) {
        setUnreadCount(count);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    const requestId = ++listRequestIdRef.current;
    setRefreshStatus((status) => (status === "idle" ? "loading" : status));
    const activeFilters = filtersRef.current;
    const [listResult, count] = await Promise.all([fetchPage(activeFilters), fetchUnreadCount()]);

    if (requestId !== listRequestIdRef.current) {
      return;
    }

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

    applyListPage(requestId, parsedPage, count);
  }, [applyListPage, fetchPage]);

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

      applyListPage(requestId, parsedPage, count);
    },
    [applyListPage, fetchPage],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

    const listResult = await fetchPage(filtersRef.current, nextCursor);
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

    setItems((current) => [...current, ...parsedPage.items]);
    setNextCursor(parsedPage.nextCursor ?? null);
    setLoadOlderStatus("idle");
  }, [fetchPage, loadOlderStatus, nextCursor]);

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
      items,
      lifecycleErrors,
      lifecyclePendingId,
      loadOlder,
      loadOlderError,
      loadOlderStatus,
      nextCursor,
      openAlert,
      openLedger,
      refresh,
      refreshStatus,
      setReadStateFilter,
      setSeverityFilter,
      toggleAlertReadState,
      unreadCount,
    }),
    [
      clearFilters,
      closeLedger,
      destinationFeedback,
      errorMessage,
      filters,
      hasActiveFilters,
      isLedgerOpen,
      items,
      lifecycleErrors,
      lifecyclePendingId,
      loadOlder,
      loadOlderError,
      loadOlderStatus,
      nextCursor,
      openAlert,
      openLedger,
      refresh,
      refreshStatus,
      setReadStateFilter,
      setSeverityFilter,
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
