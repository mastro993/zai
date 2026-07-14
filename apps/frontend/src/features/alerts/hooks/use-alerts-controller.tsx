import { Result } from "@praha/byethrow";
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

import { getUnreadAlertCount, listAlerts } from "../commands/alerts";
import { buildListAlertsQuery } from "../lib/build-list-query";
import { parseDomainAlertListPage } from "../lib/parse";
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

interface AlertsControllerValue {
  bellRef: RefObject<HTMLButtonElement | null>;
  clearFilters: () => void;
  closeLedger: () => void;
  errorMessage: string | null;
  filters: AlertSessionFilters;
  hasActiveFilters: boolean;
  isLedgerOpen: boolean;
  items: Array<DomainAlert>;
  loadOlder: () => Promise<void>;
  loadOlderError: string | null;
  loadOlderStatus: LoadOlderStatus;
  nextCursor: string | null;
  openLedger: () => void;
  refresh: () => Promise<void>;
  refreshStatus: AlertsRefreshStatus;
  setReadStateFilter: (readState: DomainAlertReadState) => void;
  setSeverityFilter: (severity: AlertSeverityFilter) => void;
  unreadCount: number;
}

const AlertsControllerContext = createContext<AlertsControllerValue | null>(null);

const fetchUnreadCount = async (): Promise<number | null> => {
  const countResult = await getUnreadAlertCount();
  return Result.isSuccess(countResult) ? countResult.value : null;
};

export function AlertsControllerProvider({ children }: { children: ReactNode }) {
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

  const fetchPage = useCallback(async (queryFilters: AlertSessionFilters, cursor?: string) => {
    return listAlerts(buildListAlertsQuery(queryFilters, cursor ? { cursor } : {}));
  }, []);

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
      if (readState === filters.readState) {
        return;
      }
      void applyFilters({ ...filters, readState });
    },
    [applyFilters, filters],
  );

  const setSeverityFilter = useCallback(
    (severity: AlertSeverityFilter) => {
      if (severity === filters.severity) {
        return;
      }
      void applyFilters({ ...filters, severity });
    },
    [applyFilters, filters],
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

    const listResult = await fetchPage(filters, nextCursor);
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
  }, [fetchPage, filters, loadOlderStatus, nextCursor]);

  const openLedger = useCallback(() => {
    setIsLedgerOpen(true);
    void refresh();
  }, [refresh]);

  const closeLedger = useCallback(() => {
    setIsLedgerOpen(false);
    bellRef.current?.focus();
  }, []);

  const hasActiveFilters = hasActiveAlertFilters(filters);

  const value = useMemo(
    () => ({
      bellRef,
      clearFilters,
      closeLedger,
      errorMessage,
      filters,
      hasActiveFilters,
      isLedgerOpen,
      items,
      loadOlder,
      loadOlderError,
      loadOlderStatus,
      nextCursor,
      openLedger,
      refresh,
      refreshStatus,
      setReadStateFilter,
      setSeverityFilter,
      unreadCount,
    }),
    [
      clearFilters,
      closeLedger,
      errorMessage,
      filters,
      hasActiveFilters,
      isLedgerOpen,
      items,
      loadOlder,
      loadOlderError,
      loadOlderStatus,
      nextCursor,
      openLedger,
      refresh,
      refreshStatus,
      setReadStateFilter,
      setSeverityFilter,
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
