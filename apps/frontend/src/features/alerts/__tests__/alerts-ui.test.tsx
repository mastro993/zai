// @vitest-environment jsdom
import { Result } from "@praha/byethrow";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";
import * as budgets from "@/features/budgets/commands/budgets";

import * as alertsCommands from "../commands/alerts";
import { AlertRow } from "../components/alert-row";
import { AlertsBell } from "../components/alerts-bell";
import { AlertsLedgerFilters } from "../components/alerts-ledger-filters";
import { AlertsLedgerDrawer } from "../components/alerts-ledger-drawer";
import { AlertsControllerProvider, useAlertsController } from "../hooks/use-alerts-controller";
import {
  alertsBellLabel,
  domainAlertSeverityLabel,
  formatAlertCreatedAt,
  formatAlertTimestamp,
} from "../lib/format";
import { isNavigableAlertDestination, isUnreadAlert, parseDomainAlertListPage } from "../lib/parse";
import { DEFAULT_ALERT_SESSION_FILTERS, setAlertSessionFilters } from "../lib/session-filters";
import type { DomainAlert } from "../types/domain-alert";

const sampleAlert: DomainAlert = {
  id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  producerKey: "budget.status",
  occurrenceKey: "period-1",
  severity: "warning",
  title: "Budget warning",
  body: "Spending exceeded 80% of allowance.",
  createdAt: "2026-07-14T10:00:00",
  updatedAt: "2026-07-14T10:00:00",
  readAt: null,
};

const budgetDestinationId = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

const budgetAlert: DomainAlert = {
  ...sampleAlert,
  destination: {
    type: "budget",
    budgetId: budgetDestinationId,
  },
};

const readAlert: DomainAlert = {
  ...sampleAlert,
  readAt: "2026-07-14T11:00:00",
};

function stubMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }),
  });
}

function ControllerProbe() {
  const controller = useAlertsController();
  return (
    <div>
      <button type="button" data-testid="open-ledger" onClick={controller.openLedger}>
        Open ledger
      </button>
      <button
        type="button"
        data-testid="toggle-read"
        onClick={() => void controller.toggleAlertReadState(sampleAlert)}
      >
        Toggle read state
      </button>
      <button
        type="button"
        data-testid="open-budget-alert"
        onClick={() => void controller.openAlert(budgetAlert)}
      >
        Open budget alert
      </button>
      <span data-testid="unread-count">{controller.unreadCount}</span>
      <span data-testid="destination-feedback">
        {controller.destinationFeedback?.message ?? ""}
      </span>
      <AlertsLedgerDrawer />
    </div>
  );
}

async function renderController(ui: ReactNode = <ControllerProbe />) {
  const rootRoute = createRootRoute({
    component: () => (
      <AlertsControllerProvider>
        <Outlet />
      </AlertsControllerProvider>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => ui,
  });
  const budgetRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/budgets/$budgetId",
    component: () => <div>Budget destination</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, budgetRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

describe("domain alert parsing", () => {
  it("accepts canonical list pages and unread state", () => {
    const parsed = parseDomainAlertListPage({
      items: [sampleAlert],
      nextCursor: null,
    });
    expect(parsed?.items).toHaveLength(1);
    expect(isUnreadAlert(sampleAlert)).toBe(true);
  });

  it("labels severities for assistive text", () => {
    expect(domainAlertSeverityLabel("critical")).toBe("Critical");
  });

  it("formats compact creation times", () => {
    expect(formatAlertCreatedAt("2026-07-14T10:00:00")).toMatch(/ago$/);
  });

  it("formats an absolute timestamp for the subtitle tooltip", () => {
    expect(formatAlertTimestamp("2026-07-14T10:00:00")).toMatch(/2026/);
    expect(formatAlertTimestamp("2026-07-14T10:00:00")).not.toMatch(/ago$/);
    expect(formatAlertTimestamp("not-a-date")).toBe("not-a-date");
  });

  it("detects navigable budget destinations", () => {
    expect(isNavigableAlertDestination(budgetAlert.destination)).toBe(true);
    expect(isNavigableAlertDestination(undefined)).toBe(false);
  });
});

describe("alert row rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows title, time-only subtitle, labelled read toggle, and immutable copy", () => {
    render(<AlertRow alert={sampleAlert} onToggleReadState={vi.fn()} />);

    screen.getByText("Budget warning");
    screen.getByRole("article", { name: /Warning alert/i });
    screen.getByText("Spending exceeded 80% of allowance.");
    screen.getByRole("button", { name: "Mark read: Budget warning", pressed: true });
    expect(screen.queryByText("New")).toBeNull();
    expect(screen.queryByText(/^Warning$/)).toBeNull();
    expect(screen.queryByText("Unread")).toBeNull();
    screen.getByText(/ago$/);
  });

  it("shows mark unread toggle for read alerts", () => {
    render(<AlertRow alert={readAlert} onToggleReadState={vi.fn()} />);

    screen.getByRole("button", { name: "Mark unread: Budget warning", pressed: false });
    expect(screen.queryByText("Read")).toBeNull();
  });

  it("toggles read state from the icon control", () => {
    const onToggleReadState = vi.fn();
    render(<AlertRow alert={sampleAlert} onToggleReadState={onToggleReadState} />);

    fireEvent.click(screen.getByRole("button", { name: "Mark read: Budget warning" }));
    expect(onToggleReadState).toHaveBeenCalledOnce();
  });

  it("renders stale destination feedback without changing alert copy", () => {
    render(
      <AlertRow
        alert={budgetAlert}
        destinationFeedback="This budget is no longer available. The alert history is unchanged."
      />,
    );

    screen.getByRole("button", { name: "Open alert: Budget warning" });
    screen.getByRole("status");
  });
});

describe("alerts bell label", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("includes exact unread count in accessible name", () => {
    expect(alertsBellLabel(0)).toBe("Alerts, 0 unread");
    expect(alertsBellLabel(3)).toBe("Alerts, 3 unread");
  });

  it("renders the bell as a ghost icon button", async () => {
    stubMatchMedia();
    await renderController(<AlertsBell />);

    const bell = await screen.findByRole("button", { name: "Alerts, 0 unread" });
    expect(bell.classList.contains("border-transparent")).toBe(true);
    expect(bell.textContent).toBe("");
  });

  it("renders a static unread badge with a sidebar ring, offset toward the corner", async () => {
    stubMatchMedia();
    vi.spyOn(alertsCommands, "listAlerts").mockResolvedValue(
      Result.succeed({ items: [sampleAlert], nextCursor: null }),
    );
    vi.spyOn(alertsCommands, "getUnreadAlertCount").mockResolvedValue(Result.succeed(2));

    await renderController(<AlertsBell />);

    const bell = await screen.findByRole("button", { name: "Alerts, 2 unread" });
    const badge = bell.querySelector("span[aria-hidden]");
    expect(badge?.className).toContain("size-1.5");
    expect(badge?.className).toContain("rounded-full");
    expect(badge?.className).toContain("[corner-shape:round]");
    expect(badge?.className).toContain("ring-sidebar");
    expect(badge?.className).toContain("top-1");
    expect(badge?.className).toContain("right-1");
    expect(badge?.className).not.toContain("animate-pulse");
  });
});

describe("alerts ledger filters", () => {
  it("opens a filter menu and forwards read and severity changes", () => {
    const onReadStateChange = vi.fn();
    const onSeverityChange = vi.fn();

    render(
      <AlertsLedgerFilters
        filters={{ readState: "unread", severity: "all" }}
        onReadStateChange={onReadStateChange}
        onSeverityChange={onSeverityChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filter notifications" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Read" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Critical" }));

    expect(onReadStateChange).toHaveBeenCalledWith("all");
    expect(onSeverityChange).toHaveBeenCalledWith("critical");
  });

  it("marks the filter trigger as applied when showing read", () => {
    render(
      <AlertsLedgerFilters
        filters={{ readState: "all", severity: "all" }}
        onReadStateChange={vi.fn()}
        onSeverityChange={vi.fn()}
      />,
    );

    screen.getByRole("button", { name: "Filter notifications, filters applied" });
  });
});

describe("alerts controller lifecycle", () => {
  beforeEach(() => {
    stubMatchMedia();
    setAlertSessionFilters(DEFAULT_ALERT_SESSION_FILTERS);
    vi.restoreAllMocks();
    vi.spyOn(alertsCommands, "listAlerts").mockResolvedValue(
      Result.succeed({ items: [], nextCursor: null }),
    );
    vi.spyOn(alertsCommands, "getUnreadAlertCount").mockResolvedValue(Result.succeed(0));
    vi.spyOn(alertsCommands, "markAllAlertsRead").mockResolvedValue(Result.succeed(0));
    vi.spyOn(alertsCommands, "markAlertRead").mockResolvedValue(
      Result.succeed({
        ...sampleAlert,
        readAt: "2026-07-14T11:00:00",
      }),
    );
    vi.spyOn(alertsCommands, "markAlertUnread").mockResolvedValue(Result.succeed(sampleAlert));
    vi.spyOn(budgets, "getBudget").mockResolvedValue(
      Result.succeed({
        id: budgetDestinationId,
        name: "Groceries",
        revision: 1,
        paused: false,
        categoryIds: [],
        cadence: "month",
        measurementMode: "spending",
        baseAllowance: 10000,
        rolloverMode: "off",
        warningPercentage: 80,
        currentPeriod: {
          start: "2026-07-01T00:00:00",
          end: "2026-08-01T00:00:00",
          baseAllowance: 10000,
          effectiveAllowance: 10000,
          netBudgetSpending: 0,
          remainingAllowance: 10000,
          status: "onTrack",
          complete: true,
          currency: "EUR",
        },
      }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("updates unread count after mark read", async () => {
    await renderController();

    fireEvent.click(screen.getByTestId("toggle-read"));

    await waitFor(() => {
      expect(alertsCommands.markAlertRead).toHaveBeenCalledWith(sampleAlert.id);
    });
  });

  it("marks unread alert read before budget navigation", async () => {
    vi.mocked(alertsCommands.markAlertRead).mockResolvedValueOnce(
      Result.succeed({
        ...budgetAlert,
        readAt: "2026-07-14T11:00:00",
      }),
    );

    const router = await renderController();

    fireEvent.click(screen.getByTestId("open-budget-alert"));

    await waitFor(() => {
      expect(alertsCommands.markAlertRead).toHaveBeenCalledWith(budgetAlert.id);
      expect(budgets.getBudget).toHaveBeenCalledWith(budgetDestinationId);
      expect(router.state.location.pathname).toBe(`/cash-flow/budgets/${budgetDestinationId}`);
    });
  });

  it("keeps alert read and shows feedback when budget destination is stale", async () => {
    vi.mocked(alertsCommands.markAlertRead).mockResolvedValueOnce(
      Result.succeed({
        ...budgetAlert,
        readAt: "2026-07-14T11:00:00",
      }),
    );
    vi.mocked(budgets.getBudget).mockResolvedValueOnce(
      Result.fail(
        new CommandError("Failed to load budget: Not found: budget", { code: "notFound" }),
      ),
    );

    const router = await renderController();

    fireEvent.click(screen.getByTestId("open-budget-alert"));

    await waitFor(() => {
      expect(screen.getByTestId("destination-feedback").textContent).toBe(
        "This budget is no longer available. The alert history is unchanged.",
      );
    });
    expect(router.state.location.pathname).toBe("/");
  });

  it("hides mark all read when no unread notifications remain", async () => {
    await renderController();

    fireEvent.click(screen.getByTestId("open-ledger"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Notifications" })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
    expect(screen.getByRole("button", { name: "Filter notifications" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No notifications" })).toBeTruthy();
    expect(screen.getByText("Important tracked-finance changes appear here.")).toBeTruthy();
    const emptyState = screen.getByRole("region", { name: "No notifications" });
    expect(emptyState.classList.contains("border")).toBe(true);
    expect(emptyState.classList.contains("border-dashed")).toBe(true);
    expect(screen.queryByText("0 unread alerts")).toBeNull();
    expect(document.querySelector('[data-slot="scroll-area"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="scroll-area-viewport"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="drawer-header"]')?.className).not.toMatch(
      /border-b/,
    );
    expect(
      document.querySelector('[data-slot="drawer-popup"][data-swipe-direction="right"]'),
    ).not.toBeNull();
    expect(alertsCommands.markAllAlertsRead).not.toHaveBeenCalled();
  });

  it("shows unread count and mark all read when unread notifications remain", async () => {
    vi.mocked(alertsCommands.getUnreadAlertCount).mockResolvedValue(Result.succeed(2));
    vi.mocked(alertsCommands.listAlerts).mockResolvedValue(
      Result.succeed({ items: [sampleAlert], nextCursor: null }),
    );

    await renderController();

    fireEvent.click(screen.getByTestId("open-ledger"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Notifications" })).toBeTruthy();
      expect(document.querySelector('[data-slot="badge"]')?.textContent).toBe("2");
      expect(screen.getByRole("button", { name: "Mark all read" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));

    await waitFor(() => {
      expect(alertsCommands.markAllAlertsRead).toHaveBeenCalledOnce();
    });
  });

  it("shows a filtered empty state with a reset action", async () => {
    await renderController();

    fireEvent.click(screen.getByTestId("open-ledger"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "No notifications" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Filter notifications" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Critical" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "No matching notifications" })).toBeTruthy();
    });
    const filteredEmpty = screen.getByRole("region", { name: "No matching notifications" });
    expect(filteredEmpty.classList.contains("border")).toBe(true);
    expect(filteredEmpty.classList.contains("border-dashed")).toBe(true);
    expect(screen.getByText("No alerts match these filters.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "No notifications" })).toBeTruthy();
    });
  });
});
