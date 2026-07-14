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
import { parseDomainAlertListPage } from "../lib/parse";
import type { DomainAlert } from "../types/domain-alert";

type AlertsRefreshStatus = "idle" | "loading" | "ready" | "error";

interface AlertsControllerValue {
  bellRef: RefObject<HTMLButtonElement | null>;
  closeLedger: () => void;
  errorMessage: string | null;
  isLedgerOpen: boolean;
  items: Array<DomainAlert>;
  openLedger: () => void;
  refresh: () => Promise<void>;
  refreshStatus: AlertsRefreshStatus;
  unreadCount: number;
}

const AlertsControllerContext = createContext<AlertsControllerValue | null>(null);

export function AlertsControllerProvider({ children }: { children: ReactNode }) {
  const bellRef = useRef<HTMLButtonElement>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [items, setItems] = useState<Array<DomainAlert>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshStatus, setRefreshStatus] = useState<AlertsRefreshStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    void refresh();
  }, [refresh]);

  const closeLedger = useCallback(() => {
    setIsLedgerOpen(false);
    bellRef.current?.focus();
  }, []);

  const value = useMemo(
    () => ({
      bellRef,
      closeLedger,
      errorMessage,
      isLedgerOpen,
      items,
      openLedger,
      refresh,
      refreshStatus,
      unreadCount,
    }),
    [
      closeLedger,
      errorMessage,
      isLedgerOpen,
      items,
      openLedger,
      refresh,
      refreshStatus,
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
