// @vitest-environment jsdom

import { Result } from "@praha/byethrow";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";
import {
  ApplicationTitleBar,
  ApplicationTitleBarProvider,
} from "@/components/application-title-bar";
import { SidebarProvider } from "@/components/ui/sidebar";
import * as alertsController from "@/features/alerts/hooks/use-alerts-controller";
import type { AlertsControllerValue } from "@/features/alerts/hooks/alerts-controller-context";
import * as breadcrumbs from "@/hooks/use-screen-breadcrumbs";

import * as recurringCommands from "../../commands/recurring-transactions";
import type { BudgetPeriodForecast, BudgetProjectionResult } from "../../types/budget-projection";
import { ForecastBoardScreen, ForecastErrorScreen } from "../forecast-board-screen";

const period = (
  overrides: Partial<BudgetPeriodForecast> &
    Pick<BudgetPeriodForecast, "budgetId" | "budgetName" | "periodStart" | "periodEnd">,
): BudgetPeriodForecast => ({
  cadence: "month",
  measurementMode: "spending",
  rolloverMode: "off",
  baseAllowance: 160_000,
  actualNetBudgetSpending: 145_000,
  projectedDelta: 0,
  forecastNetBudgetSpending: 145_000,
  remainingAllowance: 15_000,
  status: "onTrack",
  partial: false,
  coveredUntil: overrides.periodEnd,
  attribution: [],
  ...overrides,
});

interface ProjectionState {
  mode: "ready" | "empty" | "error" | "incomplete" | "refreshFail" | "defer";
  includePausedCalls: Array<boolean | undefined>;
  horizonCalls: Array<number>;
  resolve: ((value: Result.Result<BudgetProjectionResult, CommandError>) => void) | undefined;
}

const projectionState: ProjectionState = {
  mode: "ready",
  includePausedCalls: [],
  horizonCalls: [],
  resolve: undefined,
};

const readyProjection = (): BudgetProjectionResult => ({
  observedLocal: "2026-07-22T10:00:00",
  throughLocal: "2027-01-22T10:00:00",
  horizonMonths: 6,
  complete: true,
  sourceErrors: [],
  periods: [
    period({
      budgetId: "b-housing",
      budgetName: "Housing",
      periodStart: "2026-08-01T00:00:00",
      periodEnd: "2026-09-01T00:00:00",
      attribution: [
        {
          recurringTransactionId: "rt-rent",
          scheduleRevisionId: "sched-1",
          ordinal: 2,
          scheduledLocal: "2026-08-01T09:00:00",
          description: "Apartment rent",
          contribution: 145_000,
        },
      ],
    }),
    period({
      budgetId: "b-housing",
      budgetName: "Housing",
      periodStart: "2026-09-01T00:00:00",
      periodEnd: "2026-10-01T00:00:00",
      actualNetBudgetSpending: 0,
      projectedDelta: 145_000,
      forecastNetBudgetSpending: 145_000,
      partial: true,
      coveredUntil: "2026-09-22T10:00:00",
      status: null,
      attribution: [
        {
          recurringTransactionId: "rt-rent",
          scheduleRevisionId: "sched-1",
          ordinal: 3,
          scheduledLocal: "2026-09-01T09:00:00",
          description: "Apartment rent",
          contribution: 145_000,
        },
      ],
    }),
  ],
});

const incompleteProjection = (): BudgetProjectionResult => ({
  ...readyProjection(),
  complete: false,
  sourceErrors: [
    {
      kind: "dueCatchUp",
      recurringTransactionId: "rt-insurance",
      message: "Catch-up unfinished — contribution withheld",
    },
  ],
  periods: readyProjection().periods.map((item) => Object.assign({}, item, { status: null })),
});

const emptyProjection = (horizonMonths: number): BudgetProjectionResult => ({
  observedLocal: "2026-07-22T10:00:00",
  throughLocal: "2027-01-22T10:00:00",
  horizonMonths,
  complete: true,
  periods: [],
  sourceErrors: [],
});

const idleAlertsController: AlertsControllerValue = {
  bellRef: { current: null },
  clearFilters: () => undefined,
  closeLedger: () => undefined,
  destinationFeedback: null,
  errorMessage: null,
  filters: { readState: "all", severity: "all" },
  hasActiveFilters: false,
  isLedgerOpen: false,
  ledgerFocusAlertId: null,
  items: [],
  lifecycleErrors: {},
  lifecyclePendingId: null,
  loadOlder: async () => undefined,
  loadOlderError: null,
  loadOlderStatus: "idle",
  markAllRead: async () => undefined,
  markAllReadError: null,
  markAllReadPending: false,
  nextCursor: null,
  openAlert: async () => undefined,
  openLedger: () => undefined,
  refresh: async () => undefined,
  refreshStatus: "ready",
  setReadStateFilter: () => undefined,
  setSeverityFilter: () => undefined,
  toggleAlertReadState: async () => undefined,
  unreadCount: 0,
  unreadCountKnown: true,
};

function stubWindowChrome() {
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: () => undefined,
  });
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

function resolveProjection(
  horizonMonths: number,
): Result.Result<BudgetProjectionResult, CommandError> {
  if (projectionState.mode === "error") {
    return Result.fail(new CommandError("Projection unavailable"));
  }
  if (projectionState.mode === "refreshFail") {
    return Result.fail(new CommandError("Refresh failed"));
  }
  if (projectionState.mode === "empty") {
    return Result.succeed(emptyProjection(horizonMonths));
  }
  if (projectionState.mode === "incomplete") {
    return Result.succeed(incompleteProjection());
  }
  return Result.succeed(readyProjection());
}

async function renderForecast(initialProjection: BudgetProjectionResult) {
  const rootRoute = createRootRoute({
    component: () => (
      <SidebarProvider>
        <ApplicationTitleBarProvider>
          <ApplicationTitleBar buildTarget="web" />
          <Outlet />
        </ApplicationTitleBarProvider>
      </SidebarProvider>
    ),
  });
  const forecastRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/forecast",
    component: () => <ForecastBoardScreen initialProjection={initialProjection} />,
  });
  const recurringRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/recurring/$recurringTransactionId",
    component: () => <div>Recurring document</div>,
  });
  const budgetsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/budgets",
    component: () => <div>Budgets</div>,
  });
  const recurringIndexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/recurring",
    component: () => <div>Recurring</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      forecastRoute,
      recurringRoute,
      budgetsRoute,
      recurringIndexRoute,
    ]),
    history: createMemoryHistory({ initialEntries: ["/cash-flow/forecast"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

describe("forecast board screen", () => {
  beforeEach(() => {
    projectionState.mode = "ready";
    projectionState.includePausedCalls = [];
    projectionState.horizonCalls = [];
    projectionState.resolve = undefined;
    stubWindowChrome();
    vi.spyOn(breadcrumbs, "useScreenBreadcrumbs").mockReturnValue([{ label: "Forecast" }]);
    vi.spyOn(alertsController, "useAlertsController").mockReturnValue(idleAlertsController);
    vi.spyOn(recurringCommands, "getRecurringBudgetProjections").mockImplementation(
      async (input) => {
        projectionState.horizonCalls.push(input.horizonMonths);
        projectionState.includePausedCalls.push(input.includePausedBudgets);
        if (projectionState.mode === "defer") {
          return new Promise((resolve) => {
            projectionState.resolve = resolve;
          });
        }
        return resolveProjection(input.horizonMonths);
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the budgets-by-periods matrix with cell values", async () => {
    await renderForecast(readyProjection());
    expect(await screen.findByRole("table", { name: "Budget forecast matrix" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Forecast" })).toBeNull();
    expect(
      screen.queryByText(
        "Projected budget impact across periods. Forecast values are non-authoritative and do not change recorded budget state.",
      ),
    ).toBeNull();
    expect(screen.getByRole("rowheader", { name: "Housing" })).toBeTruthy();
    expect(screen.getAllByText("actual").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+ proj").length).toBeGreaterThan(0);
    expect(screen.getAllByText("forecast").length).toBeGreaterThan(0);
    expect(screen.getByText(/Partial/)).toBeTruthy();
    expect(screen.getByText(/Coverage full period/)).toBeTruthy();
    expect(screen.getByText(/Coverage partial/)).toBeTruthy();
    expect(await screen.findByLabelText("Horizon")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Include paused budgets or history" }),
    ).toBeTruthy();
  });

  it("moves focus across matrix cells with arrow keys", async () => {
    await renderForecast(readyProjection());
    const first = await screen.findByRole("button", {
      name: /Housing, 2026-08-01 to 2026-09-01/,
    });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("button", {
      name: /Housing, 2026-09-01 to 2026-10-01/,
    });
    expect(document.activeElement).toBe(second);
  });

  it("opens cell drill-down with attribution and navigates to the recurring document", async () => {
    const router = await renderForecast(readyProjection());
    const cell = await screen.findByRole("button", {
      name: /Housing, 2026-08-01 to 2026-09-01/,
    });
    fireEvent.click(cell);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Source attribution")).toBeTruthy();
    expect(within(dialog).getByText("Apartment rent")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("link", { name: "Apartment rent" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/cash-flow/recurring/rt-rent");
    });
  });

  it("shows incomplete state with typed source errors and withheld status", async () => {
    await renderForecast(incompleteProjection());
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText("Forecast incomplete")).toBeTruthy();
    expect(screen.getByText("Catch-up due")).toBeTruthy();
    expect(screen.getByText(/Catch-up unfinished/)).toBeTruthy();
    expect(screen.getAllByText("Status withheld").length).toBeGreaterThan(0);
  });

  it("shows empty and error states distinctly", async () => {
    await renderForecast(emptyProjection(6));
    const emptyState = await screen.findByRole("region", { name: "No forecast periods" });
    const emptyContent = emptyState.querySelector('[data-slot="empty-content"]');

    expect(emptyState.classList.contains("border")).toBe(true);
    expect(emptyState.classList.contains("border-dashed")).toBe(true);
    expect(emptyState.querySelector('[data-slot="empty-icon"]')).not.toBeNull();
    expect(emptyContent?.classList.contains("justify-center")).toBe(true);
    expect(screen.getByRole("heading", { name: "No forecast periods" })).toBeTruthy();
    expect(
      within(emptyState).getByText(
        "Create an active budget and recurring source, or include paused budgets to inspect history.",
      ),
    ).toBeTruthy();
    const budgetsLink = within(emptyState).getByRole("button", { name: "Open budgets" });
    const recurringLink = within(emptyState).getByRole("button", {
      name: "Open recurring transactions",
    });
    expect(budgetsLink.getAttribute("href")).toBe("/cash-flow/budgets");
    expect(recurringLink.getAttribute("href")).toBe("/cash-flow/recurring");

    cleanup();
    render(<ForecastErrorScreen message="Projection unavailable" />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Projection unavailable")).toBeTruthy();
  });

  it("refetches when horizon or paused toggle changes and separates refresh failure", async () => {
    await renderForecast(readyProjection());
    await screen.findByRole("table", { name: "Budget forecast matrix" });

    fireEvent.change(await screen.findByLabelText("Horizon"), { target: { value: "3" } });
    await waitFor(() => {
      expect(projectionState.horizonCalls.at(-1)).toBe(3);
    });

    projectionState.mode = "refreshFail";
    fireEvent.click(screen.getByRole("checkbox", { name: "Include paused budgets or history" }));
    expect(await screen.findByText("Refresh failed")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Budget forecast matrix" })).toBeTruthy();
  });

  it("returns focus to the cell after closing drill-down", async () => {
    await renderForecast(readyProjection());
    const cell = await screen.findByRole("button", {
      name: /Housing, 2026-08-01 to 2026-09-01/,
    });
    fireEvent.click(cell);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(document.activeElement).toBe(cell);
    });
  });
});
