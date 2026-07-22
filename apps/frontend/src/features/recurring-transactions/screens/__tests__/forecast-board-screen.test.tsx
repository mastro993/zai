// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BudgetPeriodForecast, BudgetProjectionResult } from "../../types/budget-projection";

vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}));

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

const { projectionState } = vi.hoisted(() => ({
  projectionState: {
    mode: "ready" as "ready" | "empty" | "error" | "incomplete" | "refreshFail" | "defer",
    includePausedCalls: [] as Array<boolean | undefined>,
    horizonCalls: [] as Array<number>,
    resolve: undefined as undefined | ((value: unknown) => void),
  },
}));

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
  periods: readyProjection().periods.map((item) =>
    Object.assign({}, item, { status: null as null }),
  ),
});

vi.mock("@/features/recurring-transactions/commands/recurring-transactions", async () => {
  const { Result } = await import("@praha/byethrow");
  return {
    getRecurringBudgetProjections: vi.fn(
      (input: { horizonMonths: number; includePausedBudgets?: boolean }) => {
        projectionState.horizonCalls.push(input.horizonMonths);
        projectionState.includePausedCalls.push(input.includePausedBudgets);
        if (projectionState.mode === "defer") {
          return new Promise((resolve) => {
            projectionState.resolve = resolve;
          });
        }
        if (projectionState.mode === "error") {
          return Promise.resolve(Result.fail({ message: "Projection unavailable" }));
        }
        if (projectionState.mode === "refreshFail") {
          return Promise.resolve(Result.fail({ message: "Refresh failed" }));
        }
        if (projectionState.mode === "empty") {
          return Promise.resolve(
            Result.succeed({
              observedLocal: "2026-07-22T10:00:00",
              throughLocal: "2027-01-22T10:00:00",
              horizonMonths: input.horizonMonths,
              complete: true,
              periods: [],
              sourceErrors: [],
            }),
          );
        }
        if (projectionState.mode === "incomplete") {
          return Promise.resolve(Result.succeed(incompleteProjection()));
        }
        return Promise.resolve(Result.succeed(readyProjection()));
      },
    ),
    getRecurringTransactions: vi.fn(() =>
      Promise.resolve(Result.succeed({ items: [], nextCursor: null })),
    ),
    getRecurringTransaction: vi.fn(() =>
      Promise.resolve(
        Result.succeed({
          recurringTransaction: {
            id: "rt-rent",
            lifecycle: "active",
            totalOccurrences: null,
            fulfilledCount: 1,
            revision: 1,
            lifecycleChangedAt: "2026-07-01T10:00:00",
            createdAt: "2026-07-01T10:00:00",
            updatedAt: "2026-07-01T10:00:00",
          },
          schedule: {
            id: "sched-1",
            recurringTransactionId: "rt-rent",
            sequence: 1,
            effectiveFromLocal: "2026-08-01T09:00:00",
            firstScheduledLocal: "2026-08-01T09:00:00",
            rule: { type: "interval", every: 1, unit: "month" },
          },
          template: {
            id: "tmpl-1",
            recurringTransactionId: "rt-rent",
            sequence: 1,
            effectiveFromLocal: "2026-08-01T09:00:00",
            amount: 145000,
            transactionType: "expense",
            description: "Apartment rent",
          },
          occurrenceSummary: {
            fulfilledCount: 1,
            totalOccurrences: null,
            nextScheduledLocal: "2026-09-01T09:00:00",
            needsAttention: false,
          },
          links: { state: "ready", occurrences: { items: [] } },
          failures: { state: "empty", waitingCount: 0, history: { items: [] } },
          budgetImpact: { state: "unavailable", message: "n/a" },
        }),
      ),
    ),
    getRecurringTransactionOccurrences: vi.fn(() =>
      Promise.resolve(Result.succeed({ items: [], nextCursor: null })),
    ),
  };
});

vi.mock("@/features/categories/commands/transaction-categories", async () => {
  const { Result } = await import("@praha/byethrow");
  return {
    getTransactionCategories: vi.fn(() => Promise.resolve(Result.succeed([]))),
  };
});

vi.mock("@/features/alerts/hooks/use-alerts-controller", () => ({
  AlertsControllerProvider: ({ children }: { children: React.ReactNode }) => children,
  useAlertsController: () => ({
    bellRef: { current: null },
    closeLedger: vi.fn(),
    destinationFeedback: null,
    errorMessage: null,
    isLedgerOpen: false,
    items: [],
    lifecycleErrors: {},
    lifecyclePendingId: null,
    openAlert: vi.fn(async () => undefined),
    openLedger: vi.fn(),
    refresh: vi.fn(async () => undefined),
    refreshStatus: "ready",
    toggleAlertReadState: vi.fn(async () => undefined),
    unreadCount: 0,
  }),
}));

vi.mock("@/features/alerts/components/alerts-bell", () => ({
  AlertsBell: () => null,
}));

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

import { routeTree } from "@/routeTree.gen";

async function renderPath(pathname: string) {
  const history = createMemoryHistory({ initialEntries: [pathname] });
  const router = createRouter({ routeTree, history });
  render(<RouterProvider router={router} />);
  await router.load();
  return router;
}

describe("forecast board screen", () => {
  beforeEach(() => {
    projectionState.mode = "ready";
    projectionState.includePausedCalls = [];
    projectionState.horizonCalls = [];
    projectionState.resolve = undefined;
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: "",
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the budgets-by-periods matrix with cell values", async () => {
    await renderPath("/cash-flow/forecast");
    expect(await screen.findByRole("heading", { name: "Forecast" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Budget forecast matrix" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "Housing" })).toBeTruthy();
    expect(screen.getAllByText("actual").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+ proj").length).toBeGreaterThan(0);
    expect(screen.getAllByText("forecast").length).toBeGreaterThan(0);
    expect(screen.getByText(/Partial/)).toBeTruthy();
    expect(screen.getByText(/Coverage full period/)).toBeTruthy();
    expect(screen.getByText(/Coverage partial/)).toBeTruthy();
    expect(screen.getByLabelText("Horizon")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Include paused budgets" })).toBeTruthy();
  });

  it("moves focus across matrix cells with arrow keys", async () => {
    await renderPath("/cash-flow/forecast");
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
    const router = await renderPath("/cash-flow/forecast");
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
    projectionState.mode = "incomplete";
    await renderPath("/cash-flow/forecast");
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText("Forecast incomplete")).toBeTruthy();
    expect(screen.getByText("Catch-up due")).toBeTruthy();
    expect(screen.getByText(/Catch-up unfinished/)).toBeTruthy();
    expect(screen.getAllByText("Status withheld").length).toBeGreaterThan(0);
  });

  it("shows empty and error states distinctly", async () => {
    projectionState.mode = "empty";
    await renderPath("/cash-flow/forecast");
    expect(await screen.findByText("No forecast periods")).toBeTruthy();

    cleanup();
    projectionState.mode = "error";
    await renderPath("/cash-flow/forecast");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Projection unavailable")).toBeTruthy();
  });

  it("refetches when horizon or paused toggle changes and separates refresh failure", async () => {
    await renderPath("/cash-flow/forecast");
    await screen.findByRole("heading", { name: "Forecast" });

    fireEvent.change(screen.getByLabelText("Horizon"), { target: { value: "3" } });
    await waitFor(() => {
      expect(projectionState.horizonCalls.at(-1)).toBe(3);
    });

    projectionState.mode = "refreshFail";
    fireEvent.click(screen.getByRole("checkbox", { name: "Include paused budgets" }));
    expect(await screen.findByText("Refresh failed")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Budget forecast matrix" })).toBeTruthy();
  });

  it("returns focus to the cell after closing drill-down", async () => {
    await renderPath("/cash-flow/forecast");
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
