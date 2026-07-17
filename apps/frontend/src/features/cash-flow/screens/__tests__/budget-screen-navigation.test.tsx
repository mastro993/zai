// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}));

const { budget, budgetState, history } = vi.hoisted(() => ({
  budget: {
    id: "budget-1",
    name: "Monthly groceries",
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
      netBudgetSpending: 2500,
      remainingAllowance: 7500,
      status: "onTrack",
    },
  },
  history: {
    data: [],
    page: 1,
    perPage: 50,
    totalPages: 1,
  },
  budgetState: {
    deferRefresh: false,
    deleted: false,
    resolveRefresh: undefined as undefined | (() => void),
  },
}));

vi.mock("@/features/cash-flow/commands/budgets", async () => {
  const { Result } = await import("@praha/byethrow");
  const success = <T,>(value: T) => Promise.resolve(Result.succeed(value));

  return {
    createBudget: vi.fn((values: { name: string }) =>
      success({ ...budget, id: "budget-2", name: values.name }),
    ),
    deleteBudget: vi.fn(() => {
      budgetState.deleted = true;
      return success(undefined);
    }),
    editBudget: vi.fn(() => success(budget)),
    getBudget: vi.fn(() => success(budget)),
    getBudgets: vi.fn(() => {
      if (!budgetState.deleted) {
        return success([budget]);
      }
      if (!budgetState.deferRefresh) {
        return success([]);
      }
      return new Promise((resolve) => {
        budgetState.resolveRefresh = () => resolve(Result.succeed([]));
      });
    }),
    getBudgetHistory: vi.fn(() => success(history)),
    pauseBudget: vi.fn(() => success(budget)),
    resumeBudget: vi.fn(() => success(budget)),
    updateBudget: vi.fn(() => success(budget)),
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

vi.mock("@/features/cash-flow/commands/transaction-categories", async () => {
  const { Result } = await import("@praha/byethrow");
  const success = <T,>(value: T) => Promise.resolve(Result.succeed(value));

  return {
    createTransactionCategory: vi.fn(() => success(undefined)),
    deleteTransactionCategories: vi.fn(() => success([])),
    getTransactionCategories: vi.fn(() => success([])),
    importTransactionCategories: vi.fn(() => success([])),
    updateTransactionCategory: vi.fn(() => success(undefined)),
  };
});

import { routeTree } from "@/routeTree.gen";

describe("cash-flow budget navigation", () => {
  beforeEach(() => {
    budgetState.deferRefresh = false;
    budgetState.deleted = false;
    budgetState.resolveRefresh = undefined;
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

  it("renders the budget detail screen after selecting a budget", async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/cash-flow/budgets"] }),
    });

    render(<RouterProvider router={router} />);

    const budgetLink = await screen.findByRole("link", { name: budget.name });
    fireEvent.click(budgetLink);

    await waitFor(() => expect(router.state.location.pathname).toBe("/cash-flow/budgets/budget-1"));
    expect(await screen.findByRole("button", { name: "Delete budget" })).toBeTruthy();
  });

  it("renders Back to budgets as a semantic link without native-button warnings", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/cash-flow/budgets"] }),
    });

    render(<RouterProvider router={router} />);

    fireEvent.click(await screen.findByRole("link", { name: budget.name }));

    const control = await screen.findByRole("button", { name: "Back to budgets" });
    expect(control.tagName).toBe("A");
    expect(control.getAttribute("href")).toMatch(/\/cash-flow\/budgets\/?$/);
    expect(
      consoleError.mock.calls.some((call: Array<unknown>) =>
        String(call[0]).includes("expected a native <button>"),
      ),
    ).toBe(false);

    consoleError.mockRestore();
  });

  it("shows a newly created budget in the active list", async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/cash-flow/budgets"] }),
    });

    render(<RouterProvider router={router} />);

    fireEvent.click(await screen.findByRole("button", { name: "New budget" }));
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "New monthly budget" },
    });
    fireEvent.change(screen.getByLabelText("Allowance"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    expect(await screen.findByRole("link", { name: "New monthly budget" })).toBeTruthy();
  });

  it("shows a newly created budget in the all list", async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/cash-flow/budgets"] }),
    });

    render(<RouterProvider router={router} />);

    const allFilter = await screen.findByRole("button", { name: "All" });
    fireEvent.click(allFilter);
    await waitFor(() => expect(allFilter.getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(screen.getByRole("button", { name: "New budget" }));
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "New monthly budget" },
    });
    fireEvent.change(screen.getByLabelText("Allowance"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    expect(await screen.findByRole("link", { name: "New monthly budget" })).toBeTruthy();
  });

  it("refreshes the budget list after deleting a budget", async () => {
    budgetState.deferRefresh = true;
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/cash-flow/budgets"] }),
    });

    render(<RouterProvider router={router} />);

    fireEvent.click(await screen.findByRole("link", { name: budget.name }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete budget" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete budget" }));

    await waitFor(() => expect(budgetState.resolveRefresh).toBeTypeOf("function"));
    budgetState.resolveRefresh?.();
    await waitFor(() => expect(router.state.location.pathname).toBe("/cash-flow/budgets"));
    await waitFor(() => expect(screen.queryByRole("link", { name: budget.name })).toBeNull());
  });
});
