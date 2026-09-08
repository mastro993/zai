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

import {
  ApplicationTitleBar,
  ApplicationTitleBarProvider,
} from "@/components/application-title-bar";
import { SidebarProvider } from "@/components/ui/sidebar";
import * as alertsController from "@/features/alerts/hooks/use-alerts-controller";
import type { AlertsControllerValue } from "@/features/alerts/hooks/alerts-controller-context";
import * as breadcrumbs from "@/hooks/use-screen-breadcrumbs";
import { categorySchema, type TransactionCategory } from "@/features/categories/types/model";

import * as budgets from "../../commands/budgets";
import { budgetSchema, type Budget, type BudgetOverview } from "../../types/budget";
import { BudgetDetailScreen } from "../budget-detail-screen";
import { BudgetScreen } from "../budget-screen";

const budget = budgetSchema.parse({
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
    complete: true,
    currency: "EUR",
  },
});

const budgetOverview: BudgetOverview = {
  ...budget,
  spendingBuckets: [
    { start: "2026-07-01T00:00:00", value: 1000, complete: true },
    { start: "2026-07-15T00:00:00", value: 1500, complete: true },
  ],
};

const categoryFixtures = [
  ["category-food", "Food", "food", "#C32828"],
  ["category-dining", "Dining", "dining", "#C39B28"],
  ["category-travel", "Travel", "travel", "#75C328"],
  ["category-home", "Home", "home", "#28C34E"],
  ["category-health", "Health", "health", "#28C3C3"],
].map(([id, name, icon, color]) =>
  categorySchema.parse({ id, name, icon, color, role: "spending" }),
);

const categoryScopeBudget = {
  ...budgetOverview,
  categoryIds: categoryFixtures.map((category) => category.id),
};

const history = {
  data: [],
  page: 1,
  perPage: 50,
  totalPages: 1,
};

interface BudgetListState {
  createdBudgetName: string | undefined;
  deferRefresh: boolean;
  deleted: boolean;
  lifecyclePaused: boolean;
  pausedOnly: boolean;
  resolveRefresh: (() => void) | undefined;
}

const budgetState: BudgetListState = {
  createdBudgetName: undefined,
  deferRefresh: false,
  deleted: false,
  lifecyclePaused: false,
  pausedOnly: false,
  resolveRefresh: undefined,
};

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

function currentBudget(): Budget {
  if (budgetState.lifecyclePaused) {
    return { ...budget, paused: true, revision: 2 };
  }
  return budget;
}

function listForFilter(filter: string | undefined): Array<BudgetOverview> {
  if (budgetState.deleted) {
    return [];
  }
  if (budgetState.pausedOnly || budgetState.lifecyclePaused) {
    return filter === "all" || filter === "paused" ? [{ ...budgetOverview, paused: true }] : [];
  }
  const listed = [budgetOverview];
  if (budgetState.createdBudgetName) {
    listed.push({ ...budgetOverview, id: "budget-2", name: budgetState.createdBudgetName });
  }
  return listed;
}

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

async function renderBudgetApp({
  initialBudgets,
  categories = [],
}: {
  initialBudgets?: Array<BudgetOverview>;
  categories?: Array<TransactionCategory>;
} = {}) {
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
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/budgets/",
    loader: async (): Promise<{ budgets: BudgetOverview[] }> => {
      const result = await budgets.getBudgets("all");
      if (Result.isFailure(result)) {
        return { budgets: [] };
      }
      return { budgets: result.value };
    },
    component: function BudgetListPage() {
      // SAFETY: list loader always returns { budgets: BudgetOverview[] }.
      const data = listRoute.useLoaderData() as { budgets: BudgetOverview[] };
      const budgetListKey = data.budgets
        .map((item) => `${item.id}:${item.revision}:${item.paused}`)
        .join("|");
      return (
        <BudgetScreen
          key={budgetListKey}
          initialBudgets={initialBudgets ?? data.budgets}
          categories={categories}
        />
      );
    },
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/budgets/$budgetId",
    loader: async ({ params }) => {
      const budgetResult = await budgets.getBudget(params.budgetId);
      const historyResult = await budgets.getBudgetHistory(params.budgetId);
      return {
        budget: Result.isSuccess(budgetResult) ? budgetResult.value : currentBudget(),
        history: Result.isSuccess(historyResult) ? historyResult.value : history,
      };
    },
    component: function BudgetDetailPage() {
      const data = detailRoute.useLoaderData();
      return (
        <BudgetDetailScreen
          budget={data?.budget ?? currentBudget()}
          history={data?.history ?? history}
          categories={[]}
        />
      );
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ["/cash-flow/budgets"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

describe("cash-flow budget navigation", () => {
  beforeEach(() => {
    budgetState.createdBudgetName = undefined;
    budgetState.deferRefresh = false;
    budgetState.deleted = false;
    budgetState.lifecyclePaused = false;
    budgetState.pausedOnly = false;
    budgetState.resolveRefresh = undefined;
    stubWindowChrome();
    vi.spyOn(breadcrumbs, "useScreenBreadcrumbs").mockReturnValue([{ label: "Budgets" }]);
    vi.spyOn(alertsController, "useAlertsController").mockReturnValue(idleAlertsController);
    vi.spyOn(budgets, "createBudget").mockImplementation(async (values) => {
      budgetState.createdBudgetName = values.name;
      return Result.succeed({ ...budget, id: "budget-2", name: values.name });
    });
    vi.spyOn(budgets, "deleteBudget").mockImplementation(async () => {
      budgetState.deleted = true;
      return Result.succeed(undefined);
    });
    vi.spyOn(budgets, "getBudget").mockImplementation(async () => Result.succeed(currentBudget()));
    vi.spyOn(budgets, "getBudgets").mockImplementation(async (filter) => {
      if (budgetState.deleted && budgetState.deferRefresh) {
        return new Promise((resolve) => {
          budgetState.resolveRefresh = () => resolve(Result.succeed([]));
        });
      }
      return Result.succeed(listForFilter(filter));
    });
    vi.spyOn(budgets, "getBudgetHistory").mockResolvedValue(Result.succeed(history));
    vi.spyOn(budgets, "pauseBudget").mockImplementation(async () => {
      budgetState.lifecyclePaused = true;
      return Result.succeed({ ...budget, paused: true, revision: 2 });
    });
    vi.spyOn(budgets, "resumeBudget").mockImplementation(async () => {
      budgetState.lifecyclePaused = false;
      return Result.succeed({ ...budget, revision: 3 });
    });
    vi.spyOn(budgets, "updateBudget").mockResolvedValue(Result.succeed(budget));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders category icons with an overflow count and left-to-right stacking", async () => {
    await renderBudgetApp({ initialBudgets: [categoryScopeBudget], categories: categoryFixtures });

    const categoryGroup = screen.getByLabelText("Categories: Food, Dining, Travel, Home, 1 more");
    expect(categoryGroup.querySelectorAll("svg")).toHaveLength(4);
    expect(within(categoryGroup).getByText("+1")).toBeTruthy();
    expect(
      Array.from(categoryGroup.querySelectorAll<HTMLElement>("[title]")).map(
        (icon) => icon.style.zIndex,
      ),
    ).toEqual(["4", "3", "2", "1"]);
  });

  it("renders the budget detail screen after selecting a budget", async () => {
    const router = await renderBudgetApp();

    const budgetLink = await screen.findByRole("link", { name: budget.name });
    expect(within(budgetLink).getByText("Spent")).toBeTruthy();
    fireEvent.click(within(budgetLink).getByText("Spent"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/cash-flow/budgets/budget-1"));
    expect(await screen.findByRole("button", { name: "Delete budget" })).toBeTruthy();
  });

  it("removes spending progress and rounds budget metric boxes", async () => {
    await renderBudgetApp();

    const budgetLink = await screen.findByRole("link", { name: budget.name });
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(
      within(budgetLink).getByRole("img", {
        name: new RegExp(`^${budget.name} budget progress`),
      }),
    ).toBeTruthy();

    const metricBoxes = ["Allowance", "Spent", "Remaining"].map((label) => {
      const metricLabel = within(budgetLink).getByText(label, { exact: true });
      return metricLabel.parentElement;
    });
    expect(metricBoxes).toHaveLength(3);
    expect(metricBoxes.every((box) => box?.classList.contains("rounded-md"))).toBe(true);
  });

  it("renders Back to budgets as a semantic link without native-button warnings", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await renderBudgetApp();

    fireEvent.click(await screen.findByRole("link", { name: budget.name }));

    const control = await screen.findByRole("button", { name: "Back to budgets" });
    expect(control.tagName).toBe("A");
    expect(control.getAttribute("href")).toMatch(/\/cash-flow\/budgets\/?$/);
    expect(
      consoleError.mock.calls.some((call) =>
        String(call[0]).includes("expected a native <button>"),
      ),
    ).toBe(false);

    consoleError.mockRestore();
  });

  it("shows a newly created budget in the active list", async () => {
    await renderBudgetApp();

    fireEvent.click(await screen.findByRole("button", { name: "Add budget" }));
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
    await renderBudgetApp();

    const allFilter = await screen.findByRole("tab", { name: "All" });
    fireEvent.click(allFilter);
    await waitFor(() => expect(allFilter.getAttribute("aria-selected")).toBe("true"));

    fireEvent.click(screen.getByRole("button", { name: "Add budget" }));
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "New monthly budget" },
    });
    fireEvent.change(screen.getByLabelText("Allowance"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    expect(await screen.findByRole("link", { name: "New monthly budget" })).toBeTruthy();
  });

  it("keeps the filters available when only paused budgets exist", async () => {
    budgetState.pausedOnly = true;
    await renderBudgetApp();

    expect(await screen.findByText("No active budgets")).toBeTruthy();
    const pausedFilter = screen.getByRole("tab", { name: "Paused" });
    fireEvent.click(pausedFilter);

    await waitFor(() => expect(pausedFilter.getAttribute("aria-selected")).toBe("true"));
    expect(await screen.findByRole("link", { name: budget.name })).toBeTruthy();
  });

  it("refreshes the budget list after changing lifecycle state", async () => {
    await renderBudgetApp();

    fireEvent.click(await screen.findByRole("link", { name: budget.name }));
    fireEvent.click(await screen.findByRole("button", { name: "Pause budget" }));
    expect(await screen.findByText("Paused ·", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to budgets" }));

    expect(await screen.findByText("No active budgets")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Paused" })).toBeTruthy();
  });

  it("refreshes the budget list after deleting a budget", async () => {
    budgetState.deferRefresh = true;
    const router = await renderBudgetApp();

    fireEvent.click(await screen.findByRole("link", { name: budget.name }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete budget" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete budget" }));

    await waitFor(() => expect(budgetState.resolveRefresh).not.toBeUndefined());
    budgetState.resolveRefresh?.();
    await waitFor(() => expect(router.state.location.pathname).toBe("/cash-flow/budgets"));
    await waitFor(() => expect(screen.queryByRole("link", { name: budget.name })).toBeNull());
  });
});
