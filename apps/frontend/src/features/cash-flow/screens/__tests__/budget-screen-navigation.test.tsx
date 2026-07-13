// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}));

const { budget, history } = vi.hoisted(() => ({
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
}));

vi.mock("@/features/cash-flow/commands/budgets", async () => {
  const { Result } = await import("@praha/byethrow");
  const success = <T,>(value: T) => Promise.resolve(Result.succeed(value));

  return {
    createBudget: vi.fn(() => success(budget)),
    deleteBudget: vi.fn(() => success(undefined)),
    editBudget: vi.fn(() => success(budget)),
    getBudget: vi.fn(() => success(budget)),
    getBudgets: vi.fn(() => success([budget])),
    getBudgetHistory: vi.fn(() => success(history)),
    pauseBudget: vi.fn(() => success(budget)),
    resumeBudget: vi.fn(() => success(budget)),
    updateBudget: vi.fn(() => success(budget)),
  };
});

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
});
