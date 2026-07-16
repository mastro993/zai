import { Result } from "@praha/byethrow";
import { useCallback, useRef, useState } from "react";

import { listAlerts } from "../commands/alerts";
import { buildListAlertsQuery } from "../lib/build-list-query";
import { mergeReconciledAlertPage } from "../lib/merge-page";
import { isUnreadAlert, parseDomainAlertListPage } from "../lib/parse";
import {
  getAlertSessionFilters,
  setAlertSessionFilters,
  type AlertSessionFilters,
  type AlertSeverityFilter,
} from "../lib/session-filters";
import type { DomainAlert, DomainAlertReadState } from "../types/domain-alert";
import type { AlertsRefreshStatus, LoadOlderStatus } from "./alerts-controller-context";
import { fetchUnreadCount } from "./alerts-controller-queries";

interface RefreshOptions {
  preserveItems?: boolean;
}

export function useAlertListController() {
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
      if (readState !== currentFilters.readState) {
        void applyFilters({ ...currentFilters, readState });
      }
    },
    [applyFilters],
  );

  const setSeverityFilter = useCallback(
    (severity: AlertSeverityFilter) => {
      const currentFilters = filtersRef.current;
      if (severity !== currentFilters.severity) {
        void applyFilters({ ...currentFilters, severity });
      }
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

  return {
    clearFilters,
    errorMessage,
    filters,
    items,
    loadOlder,
    loadOlderError,
    loadOlderStatus,
    nextCursor,
    refresh,
    refreshStatus,
    setItems,
    setReadStateFilter,
    setSeverityFilter,
    syncAlertUpdate,
    unreadCount,
    unreadCountKnown,
  };
}

export type AlertListController = ReturnType<typeof useAlertListController>;
