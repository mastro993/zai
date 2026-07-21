// @vitest-environment jsdom
import { Result } from "@praha/byethrow";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

import * as alertsCommands from "../commands/alerts";
import { AlertsControllerProvider, useAlertsController } from "../hooks/use-alerts-controller";
import { setAlertSessionFilters } from "../lib/session-filters";
import type { DomainAlertListPage } from "../types/domain-alert";

const pageOne: DomainAlertListPage = {
  items: [
    {
      id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      producerKey: "budget.status",
      occurrenceKey: "a",
      severity: "warning",
      title: "Warning alert",
      body: "Body",
      createdAt: "2026-07-14T10:00:00",
      updatedAt: "2026-07-14T10:00:00",
      readAt: null,
    },
  ],
  nextCursor: "cursor-page-2",
};

const pageTwo: DomainAlertListPage = {
  items: [
    {
      id: "7ba7b810-9dad-11d1-80b4-00c04fd430c9",
      producerKey: "budget.status",
      occurrenceKey: "b",
      severity: "info",
      title: "Older alert",
      body: "Body",
      createdAt: "2026-07-13T10:00:00",
      updatedAt: "2026-07-13T10:00:00",
      readAt: null,
    },
  ],
  nextCursor: null,
};

describe("alerts controller filters and pagination", () => {
  beforeEach(() => {
    setAlertSessionFilters({ readState: "all", severity: "all" });
    vi.restoreAllMocks();
    vi.spyOn(alertsCommands, "getUnreadAlertCount").mockResolvedValue(Result.succeed(2));
    vi.spyOn(alertsCommands, "listAlerts").mockResolvedValue(Result.succeed(pageOne));
    vi.spyOn(alertsCommands, "markAllAlertsRead").mockResolvedValue(Result.succeed(1));
    vi.spyOn(alertsCommands, "markAlertRead").mockImplementation(async (id) =>
      Result.succeed({ ...pageOne.items[0], id, readAt: "2026-07-14T11:00:00" }),
    );
    vi.spyOn(alertsCommands, "markAlertUnread").mockImplementation(async (id) =>
      Result.succeed({ ...pageOne.items[0], id, readAt: null }),
    );
  });

  it("loads the first page on mount and exposes next cursor", async () => {
    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });

    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.nextCursor).toBe("cursor-page-2");
    expect(alertsCommands.listAlerts).toHaveBeenCalledWith({});
  });

  it("refetches when read-state filter changes", async () => {
    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      result.current.setReadStateFilter("unread");
    });

    await waitFor(() =>
      expect(alertsCommands.listAlerts).toHaveBeenLastCalledWith({ readState: "unread" }),
    );
    expect(result.current.filters.readState).toBe("unread");
  });

  it("appends older alerts without clearing the first page", async () => {
    vi.mocked(alertsCommands.listAlerts)
      .mockResolvedValueOnce(Result.succeed(pageOne))
      .mockResolvedValueOnce(Result.succeed(pageTwo));

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      await result.current.loadOlder();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(alertsCommands.listAlerts).toHaveBeenLastCalledWith({ cursor: "cursor-page-2" });
    expect(result.current.nextCursor).toBeNull();
  });

  it("retains rows when refresh fails", async () => {
    vi.mocked(alertsCommands.listAlerts)
      .mockResolvedValueOnce(Result.succeed(pageOne))
      .mockResolvedValueOnce(Result.fail(new CommandError("network down")));

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.refreshStatus).toBe("error"));
    expect(result.current.items).toHaveLength(1);
  });

  it("ignores stale refresh responses after a filter change", async () => {
    let releaseStaleRefresh: ((page: DomainAlertListPage) => void) | undefined;
    const staleRefresh = new Promise<DomainAlertListPage>((resolve) => {
      releaseStaleRefresh = resolve;
    });
    let holdDefaultRefresh = false;

    vi.mocked(alertsCommands.listAlerts).mockImplementation((query) => {
      if (query?.readState === "unread") {
        return Promise.resolve(
          Result.succeed({
            items: pageOne.items,
            nextCursor: "cursor-page-2",
          }),
        );
      }

      if (holdDefaultRefresh) {
        return staleRefresh.then((page) => Result.succeed(page));
      }

      return Promise.resolve(Result.succeed({ items: pageOne.items, nextCursor: null }));
    });

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    holdDefaultRefresh = true;
    await act(async () => {
      void result.current.openLedger();
      result.current.setReadStateFilter("unread");
    });

    await waitFor(() => expect(result.current.nextCursor).toBe("cursor-page-2"));

    await act(async () => {
      releaseStaleRefresh?.({ items: pageOne.items, nextCursor: null });
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.nextCursor).toBe("cursor-page-2");
  });

  it("refreshes canonical page and exact unread count after marking all read", async () => {
    setAlertSessionFilters({ readState: "unread", severity: "warning" });
    const refreshedPage: DomainAlertListPage = {
      items: [],
      nextCursor: null,
    };
    vi.mocked(alertsCommands.listAlerts)
      .mockResolvedValueOnce(Result.succeed(pageOne))
      .mockResolvedValueOnce(Result.succeed(refreshedPage));
    vi.mocked(alertsCommands.getUnreadAlertCount)
      .mockResolvedValueOnce(Result.succeed(2))
      .mockResolvedValueOnce(Result.succeed(0));

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(alertsCommands.markAllAlertsRead).toHaveBeenCalledOnce();
    expect(alertsCommands.listAlerts).toHaveBeenLastCalledWith({
      readState: "unread",
      severities: ["warning"],
    });
    expect(result.current.filters).toEqual({ readState: "unread", severity: "warning" });
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.items).toEqual([]);
  });

  it("retains rows when mark-all refresh fails but reconciles unread count", async () => {
    vi.mocked(alertsCommands.listAlerts)
      .mockResolvedValueOnce(Result.succeed(pageOne))
      .mockResolvedValueOnce(Result.fail(new CommandError("refresh down")));
    vi.mocked(alertsCommands.getUnreadAlertCount)
      .mockResolvedValueOnce(Result.succeed(2))
      .mockResolvedValueOnce(Result.succeed(0));

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.refreshStatus).toBe("error");
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].readAt).not.toBeNull();
    expect(result.current.unreadCount).toBe(0);
  });

  it("retains rows and disables bulk action when count reconciliation fails", async () => {
    vi.mocked(alertsCommands.listAlerts)
      .mockResolvedValueOnce(Result.succeed(pageOne))
      .mockResolvedValueOnce(Result.succeed({ items: [], nextCursor: null }));
    vi.mocked(alertsCommands.getUnreadAlertCount)
      .mockResolvedValueOnce(Result.succeed(2))
      .mockResolvedValueOnce(Result.fail(new CommandError("count down")));

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.refreshStatus).toBe("error");
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].readAt).not.toBeNull();
    expect(result.current.unreadCountKnown).toBe(false);
  });

  it("exposes mark-all errors without clearing the current page", async () => {
    vi.mocked(alertsCommands.markAllAlertsRead).mockResolvedValueOnce(
      Result.fail(new CommandError("bulk operation failed")),
    );

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.markAllReadError).toBe("bulk operation failed");
    expect(result.current.items).toEqual(pageOne.items);
    expect(alertsCommands.listAlerts).toHaveBeenCalledOnce();
  });

  it("does not append an older page after bulk refresh starts", async () => {
    let firstPage = true;
    let releaseOlder: ((page: DomainAlertListPage) => void) | undefined;
    const olderPage = new Promise<DomainAlertListPage>((resolve) => {
      releaseOlder = resolve;
    });
    const refreshedPage: DomainAlertListPage = {
      items: [{ ...pageOne.items[0], readAt: "2026-07-14T11:00:00" }],
      nextCursor: null,
    };

    vi.mocked(alertsCommands.listAlerts).mockImplementation((query) => {
      if (query?.cursor) {
        return olderPage.then((page) => Result.succeed(page));
      }
      if (firstPage) {
        firstPage = false;
        return Promise.resolve(Result.succeed(pageOne));
      }
      return Promise.resolve(Result.succeed(refreshedPage));
    });
    vi.mocked(alertsCommands.getUnreadAlertCount)
      .mockResolvedValueOnce(Result.succeed(2))
      .mockResolvedValueOnce(Result.succeed(0));

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    let loadOlderPromise: Promise<void> | undefined;
    await act(async () => {
      loadOlderPromise = result.current.loadOlder();
    });
    await waitFor(() =>
      expect(alertsCommands.listAlerts).toHaveBeenLastCalledWith({ cursor: "cursor-page-2" }),
    );

    await act(async () => {
      await result.current.markAllRead();
    });
    releaseOlder?.(pageTwo);
    await loadOlderPromise;

    expect(result.current.items).toEqual(refreshedPage.items);
    expect(result.current.nextCursor).toBeNull();
  });

  it("removes a row from unread after marking it read", async () => {
    setAlertSessionFilters({ readState: "unread", severity: "all" });
    vi.mocked(alertsCommands.listAlerts)
      .mockResolvedValueOnce(Result.succeed(pageOne))
      .mockResolvedValueOnce(Result.succeed({ items: [], nextCursor: null }));
    vi.mocked(alertsCommands.getUnreadAlertCount)
      .mockResolvedValueOnce(Result.succeed(1))
      .mockResolvedValueOnce(Result.succeed(0));

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      await result.current.toggleAlertReadState(pageOne.items[0]);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("removes a row from read after marking it unread", async () => {
    const readPage: DomainAlertListPage = {
      items: [{ ...pageOne.items[0], readAt: "2026-07-14T11:00:00" }],
      nextCursor: null,
    };
    setAlertSessionFilters({ readState: "read", severity: "all" });
    vi.mocked(alertsCommands.listAlerts)
      .mockResolvedValueOnce(Result.succeed(readPage))
      .mockResolvedValueOnce(Result.succeed({ items: [], nextCursor: null }));
    vi.mocked(alertsCommands.getUnreadAlertCount)
      .mockResolvedValueOnce(Result.succeed(0))
      .mockResolvedValueOnce(Result.succeed(1));

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      await result.current.toggleAlertReadState(readPage.items[0]);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(1);
  });

  it("keeps an updated row under the all filter", async () => {
    const readItem = { ...pageOne.items[0], readAt: "2026-07-14T11:00:00" };
    vi.mocked(alertsCommands.listAlerts)
      .mockResolvedValueOnce(Result.succeed(pageOne))
      .mockResolvedValueOnce(Result.succeed({ items: [readItem], nextCursor: null }));
    vi.mocked(alertsCommands.getUnreadAlertCount)
      .mockResolvedValueOnce(Result.succeed(1))
      .mockResolvedValueOnce(Result.succeed(0));

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      await result.current.toggleAlertReadState(pageOne.items[0]);
    });

    expect(result.current.items).toEqual([readItem]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("keeps loaded older unread rows after marking one read", async () => {
    setAlertSessionFilters({ readState: "unread", severity: "all" });
    vi.mocked(alertsCommands.listAlerts)
      .mockResolvedValueOnce(Result.succeed(pageOne))
      .mockResolvedValueOnce(Result.succeed(pageTwo))
      .mockResolvedValueOnce(Result.succeed({ items: [], nextCursor: "cursor-page-2" }));
    vi.mocked(alertsCommands.getUnreadAlertCount)
      .mockResolvedValueOnce(Result.succeed(2))
      .mockResolvedValueOnce(Result.succeed(1));

    const { result } = renderHook(() => useAlertsController(), {
      wrapper: AlertsControllerProvider,
    });
    await waitFor(() => expect(result.current.refreshStatus).toBe("ready"));

    await act(async () => {
      await result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => {
      await result.current.toggleAlertReadState(pageOne.items[0]);
    });

    expect(result.current.items).toEqual([pageTwo.items[0]]);
    expect(result.current.unreadCount).toBe(1);
  });
});
