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
});
