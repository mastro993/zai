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
import { alertsBellLabel, domainAlertSeverityLabel, formatAlertCreatedAt } from "../lib/format";
import { isNavigableAlertDestination, isUnreadAlert, parseDomainAlertListPage } from "../lib/parse";
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

  it("detects navigable budget destinations", () => {
    expect(isNavigableAlertDestination(budgetAlert.destination)).toBe(true);
    expect(isNavigableAlertDestination(undefined)).toBe(false);
  });
});

describe("alert row rendering", () => {
  it("shows severity text, unread badge, labelled lifecycle action, and immutable copy", () => {
    render(<AlertRow alert={sampleAlert} onToggleReadState={vi.fn()} />);

    screen.getByText("Budget warning");
    screen.getByText("New");
    screen.getByRole("article", { name: /Warning alert/i });
    screen.getByText("Spending exceeded 80% of allowance.");
    screen.getByRole("button", { name: "Mark read: Budget warning" });
    screen.getByText("Unread");
  });

  it("shows mark unread for read alerts", () => {
    render(<AlertRow alert={readAlert} onToggleReadState={vi.fn()} />);

    screen.getByRole("button", { name: "Mark unread: Budget warning" });
    screen.getByText("Read");
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
});

describe("alerts ledger filters", () => {
  it("forwards read and severity changes", () => {
    const onReadStateChange = vi.fn();
    const onSeverityChange = vi.fn();

    render(
      <AlertsLedgerFilters
        filters={{ readState: "all", severity: "all" }}
        onReadStateChange={onReadStateChange}
        onSeverityChange={onSeverityChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unread" }));
    fireEvent.click(screen.getByRole("button", { name: "Critical" }));

    expect(onReadStateChange).toHaveBeenCalledWith("unread");
    expect(onSeverityChange).toHaveBeenCalledWith("critical");
  });
});

describe("alerts controller lifecycle", () => {
  beforeEach(() => {
    stubMatchMedia();
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
    expect(screen.queryByText("0 unread alerts")).toBeNull();
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
});
