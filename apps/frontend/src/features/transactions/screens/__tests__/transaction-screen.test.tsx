// @vitest-environment jsdom

import { Result } from "@praha/byethrow";
import { cleanup, act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { toast } from "@/components/toaster/toast";
import { SidebarProvider } from "@/components/ui/sidebar";
import * as alertsController from "@/features/alerts/hooks/use-alerts-controller";
import type { AlertsControllerValue } from "@/features/alerts/hooks/alerts-controller-context";
import { categorySchema, type TransactionCategory } from "@/features/categories/types/model";
import * as transactionCategories from "@/features/categories/commands/transaction-categories";
import * as recurringCommands from "@/features/recurring-transactions/commands/recurring-transactions";
import * as currencyCommands from "@/features/currency/commands/currency";
import * as currencyEvents from "@/features/currency/commands/currency-state-events";
import { CurrencyBootstrapProvider } from "@/features/currency/hooks/use-currency-bootstrap";
import * as breadcrumbs from "@/hooks/use-screen-breadcrumbs";

import * as transactions from "../../commands/transactions";
import { type PaginatedTransactions } from "../../types/model";
import { sampleListItem, sampleTransaction } from "../../types/sample";
import { TransactionScreen } from "../transaction-screen";

const coffee = sampleListItem({
  id: "tx-initial",
  description: "Initial coffee",
  transactionDate: "2026-07-01T10:00:00",
  transactionType: "expense",
  transactionCategoryId: null,
  notes: null,
  convertedAmount: 350,
  convertedCurrency: "EUR",
  complete: true,
});

const staleRent = sampleListItem({
  id: "tx-stale",
  description: "Stale rent",
  transactionDate: "2026-07-02T10:00:00",
  transactionType: "expense",
  transactionCategoryId: null,
  notes: null,
  convertedAmount: 120000,
  convertedCurrency: "EUR",
  complete: true,
});

const freshSalary = sampleListItem({
  id: "tx-current",
  description: "Fresh salary",
  transactionDate: "2026-07-03T10:00:00",
  transactionType: "income",
  transactionCategoryId: null,
  notes: null,
  convertedAmount: 250000,
  convertedCurrency: "EUR",
  complete: true,
});

const food = categorySchema.parse({
  id: "cat-1",
  parentId: null,
  name: "Food",
  description: null,
  color: "#C55B26",
  role: "spending",
});

const page = (
  data: Array<ReturnType<typeof sampleListItem>>,
  currentPage: number,
  totalPages: number,
): PaginatedTransactions => ({
  data,
  page: currentPage,
  perPage: 50,
  totalPages,
});

interface TransactionRequestState {
  releaseStale: (() => void) | undefined;
  releaseCurrent: (() => void) | undefined;
  holdStale: boolean;
  holdCurrent: boolean;
  returnInitialEmpty: boolean;
  returnEmptyOnPage2: boolean;
  returnEmptyForQuery: boolean;
}

const transactionState: TransactionRequestState = {
  releaseStale: undefined,
  releaseCurrent: undefined,
  holdStale: false,
  holdCurrent: false,
  returnInitialEmpty: false,
  returnEmptyOnPage2: false,
  returnEmptyForQuery: false,
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

const initialData = {
  transactions: page([coffee], 1, 2),
  categories: [food],
};

function stubWindowChrome() {
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

function resolveTransactions(
  currentPage: number,
  query: string,
):
  | Result.Result<PaginatedTransactions, CommandError>
  | Promise<Result.Result<PaginatedTransactions, CommandError>> {
  if (query === "stale") {
    if (transactionState.holdStale) {
      return new Promise((resolve) => {
        transactionState.releaseStale = () => resolve(Result.succeed(page([staleRent], 1, 1)));
      });
    }
  }

  if (query === "current") {
    if (transactionState.holdCurrent) {
      return new Promise((resolve) => {
        transactionState.releaseCurrent = () => resolve(Result.succeed(page([freshSalary], 1, 1)));
      });
    }
    return Result.succeed(page([freshSalary], 1, 1));
  }

  if (query === "stale-fail") {
    if (transactionState.holdStale) {
      return new Promise((resolve) => {
        transactionState.releaseStale = () =>
          resolve(Result.fail(new CommandError("stale request failed")));
      });
    }
  }

  if (query === "no-matches" && transactionState.returnEmptyForQuery) {
    return Result.succeed(page([], 1, 1));
  }

  if (query === "empty-page" && currentPage === 2) {
    return Result.succeed(page([], 2, 2));
  }

  if (!query && transactionState.returnInitialEmpty) {
    return Result.succeed(page([], 1, 1));
  }

  if (currentPage === 2 && transactionState.returnEmptyOnPage2) {
    return Result.succeed(page([], 2, 2));
  }

  if (currentPage === 2 && !query && transactionState.holdStale) {
    return new Promise((resolve) => {
      transactionState.releaseStale = () => resolve(Result.succeed(page([], 2, 2)));
    });
  }

  return Result.succeed(page([coffee], currentPage, 2));
}

async function renderScreen(
  data: {
    transactions: PaginatedTransactions;
    categories: Array<TransactionCategory>;
  } = initialData,
) {
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
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <CurrencyBootstrapProvider>
        <TransactionScreen initialData={data} />
      </CurrencyBootstrapProvider>
    ),
  });
  const categoriesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/categories",
    component: () => <div>Categories</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, categoriesRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

const typeSearchQuery = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText("Search description or notes..."), {
    target: { value },
  });
  vi.advanceTimersByTime(250);
};

const goToNextPage = () => {
  fireEvent.click(screen.getByLabelText("Go to next page"));
};

describe("transaction screen request guard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    transactionState.holdStale = false;
    transactionState.holdCurrent = false;
    transactionState.returnInitialEmpty = false;
    transactionState.returnEmptyOnPage2 = false;
    transactionState.returnEmptyForQuery = false;
    transactionState.releaseStale = undefined;
    transactionState.releaseCurrent = undefined;
    stubWindowChrome();
    vi.spyOn(currencyEvents, "createCurrencyStateEventTransport").mockImplementation(() => ({
      subscribe: (_onEvent, _onReconnect) => ({
        ready: Promise.resolve(Result.succeed(undefined)),
        close: () => undefined,
      }),
    }));
    vi.spyOn(currencyCommands, "getCurrencyBootstrap").mockResolvedValue(
      Result.succeed({ setupComplete: true, defaultCurrency: "EUR" }),
    );
    vi.spyOn(currencyCommands, "getSupportedCurrencies").mockResolvedValue(
      Result.succeed([{ code: "EUR", name: "Euro" }]),
    );
    vi.spyOn(currencyCommands, "getCurrencyStatus").mockResolvedValue(
      Result.succeed({ job: null }),
    );
    vi.spyOn(currencyCommands, "getCurrencies").mockResolvedValue(
      Result.succeed([
        {
          code: "EUR",
          name: "Euro",
          status: "enabled",
          coverageFrom: null,
          coverageTo: null,
          lastRefresh: null,
          refreshStatus: "idle",
          missingPeriods: [],
          usedByRecurring: false,
          isDefault: true,
        },
      ]),
    );
    vi.spyOn(breadcrumbs, "useScreenBreadcrumbs").mockReturnValue([{ label: "Transactions" }]);
    vi.spyOn(alertsController, "useAlertsController").mockReturnValue(idleAlertsController);
    vi.spyOn(toast, "success").mockReturnValue(1);
    vi.spyOn(toast, "error").mockReturnValue(1);
    vi.spyOn(toast, "info").mockReturnValue(1);
    vi.spyOn(transactions, "getTransactions").mockImplementation(
      async (currentPage, _perPage, filters) =>
        resolveTransactions(currentPage ?? 1, filters?.query ?? ""),
    );
    vi.spyOn(transactions, "createTransaction").mockResolvedValue(
      Result.succeed(
        sampleTransaction({
          id: "tx-new",
          description: null,
          amount: 0,
          transactionDate: "2026-07-15T10:00:00",
          transactionType: "expense",
          transactionCategoryId: null,
          notes: null,
        }),
      ),
    );
    vi.spyOn(transactions, "getTransaction").mockImplementation(async (transactionId) =>
      Result.succeed(
        sampleTransaction({
          id: transactionId,
          description: coffee.description,
          amount: 350,
          transactionDate: coffee.transactionDate,
          transactionType: coffee.transactionType,
        }),
      ),
    );
    vi.spyOn(transactionCategories, "getTransactionCategories").mockResolvedValue(
      Result.succeed([
        categorySchema.parse({
          id: "cat-2",
          parentId: null,
          name: "Imported category",
          description: null,
          color: "#C55B26",
          role: "spending",
        }),
      ]),
    );
    vi.spyOn(recurringCommands, "getTransactionRecurringProvenance").mockResolvedValue(
      Result.succeed(null),
    );
    vi.spyOn(recurringCommands, "previewRecurringAdoption").mockImplementation(
      async (transactionId) =>
        Result.succeed({
          transactionId,
          firstScheduledLocal: "2026-07-01T10:00:00",
          laterDueCount: 0,
        }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("ignores older success after a newer success", async () => {
    transactionState.holdStale = true;

    await renderScreen();
    expect(screen.getByText("Initial coffee")).toBeTruthy();

    typeSearchQuery("stale");
    typeSearchQuery("current");

    await waitFor(() => expect(screen.getByText("Fresh salary")).toBeTruthy());

    transactionState.releaseStale?.();
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(screen.queryByText("Stale rent")).toBeNull());
    expect(screen.getByText("Fresh salary")).toBeTruthy();
  });

  it("ignores older failure after a newer success", async () => {
    transactionState.holdStale = true;

    await renderScreen();
    typeSearchQuery("stale-fail");
    typeSearchQuery("current");

    await waitFor(() => expect(screen.getByText("Fresh salary")).toBeTruthy());

    transactionState.releaseStale?.();
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => expect(screen.queryByText("stale request failed")).toBeNull());
    expect(screen.getByText("Fresh salary")).toBeTruthy();
  });

  it("does not clear loading early when an older request completes after the current one", async () => {
    vi.useRealTimers();
    transactionState.holdStale = true;
    transactionState.holdCurrent = true;

    await renderScreen();
    fireEvent.change(screen.getByPlaceholderText("Search description or notes..."), {
      target: { value: "stale" },
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await waitFor(() => expect(screen.getByText("Loading transactions...")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText("Search description or notes..."), {
      target: { value: "current" },
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    await act(async () => {
      transactionState.releaseCurrent?.();
    });
    await waitFor(() => expect(screen.queryByText("Loading transactions...")).toBeNull());
    await waitFor(() => expect(screen.getByText("Fresh salary")).toBeTruthy());

    await act(async () => {
      transactionState.releaseStale?.();
    });
    expect(screen.queryByText("Loading transactions...")).toBeNull();
    expect(screen.getByText("Fresh salary")).toBeTruthy();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("runs empty-page fallback only for the active request", async () => {
    transactionState.holdStale = true;

    await renderScreen();
    goToNextPage();
    await waitFor(() =>
      expect(transactions.getTransactions).toHaveBeenLastCalledWith(2, 50, undefined),
    );

    typeSearchQuery("current");
    await waitFor(() => expect(screen.getByText("Fresh salary")).toBeTruthy());

    transactionState.releaseStale?.();
    await vi.runOnlyPendingTimersAsync();

    expect(screen.getByText("Fresh salary")).toBeTruthy();
    expect(screen.queryByText("No transactions on this page")).toBeNull();
  });

  it("corrects to the previous page when the active request returns an empty page", async () => {
    transactionState.returnEmptyOnPage2 = true;

    await renderScreen();

    goToNextPage();

    await waitFor(() =>
      expect(transactions.getTransactions).toHaveBeenLastCalledWith(1, 50, undefined),
    );
  });

  it("opens the import wizard from the header action", async () => {
    await renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Import transactions" }));

    expect(await screen.findByRole("dialog", { name: "Import transactions" })).toBeTruthy();
  });

  it("debounces search before issuing a request", async () => {
    await renderScreen();

    const searchInput = screen.getByPlaceholderText("Search description or notes...");
    fireEvent.change(searchInput, { target: { value: "cur" } });
    vi.advanceTimersByTime(100);
    fireEvent.change(searchInput, { target: { value: "current" } });
    vi.advanceTimersByTime(250);

    await waitFor(() => expect(screen.getByText("Fresh salary")).toBeTruthy());
    expect(
      vi
        .mocked(transactions.getTransactions)
        .mock.calls.filter(([, , filters]) => filters?.query === "current"),
    ).toHaveLength(1);
  });

  it("styles missing descriptions as muted italic text", async () => {
    await renderScreen({
      transactions: page(
        [
          sampleListItem({
            id: "tx-no-description",
            description: null,
            convertedAmount: 350,
            transactionDate: "2026-07-01T10:00:00",
            transactionType: "expense",
            transactionCategoryId: null,
            notes: null,
          }),
        ],
        1,
        1,
      ),
      categories: [],
    });

    const noDescription = screen.getByText("No description");

    expect(noDescription.classList.contains("text-muted-foreground")).toBe(true);
    expect(noDescription.classList.contains("italic")).toBe(true);
  });

  it("toasts when a transaction is created", async () => {
    await renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "New transaction" }));
    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Transaction created"));
  });

  it("focuses the amount field when opening a new transaction", async () => {
    await renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "New transaction" }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Amount")));
  });

  it("opens recurring adoption in the shared recurring form", async () => {
    await renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Adopt Initial coffee as recurring" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Adopt as recurring" })).toBeTruthy();
    });
    expect(screen.getByLabelText("Amount")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Occurrences")).toHaveProperty("disabled", false);
  });

  it("blocks recurring adoption when the source transaction has no description", async () => {
    await renderScreen({
      transactions: page(
        [
          sampleListItem({
            id: "tx-no-description",
            description: "   ",
            convertedAmount: 350,
            transactionDate: "2026-07-01T10:00:00",
            transactionType: "expense",
            transactionCategoryId: null,
            notes: null,
          }),
        ],
        1,
        1,
      ),
      categories: [],
    });

    fireEvent.click(screen.getByTitle("Make recurring"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Add a description to this transaction before adopting it.",
      );
    });
    expect(screen.queryByRole("heading", { name: "Adopt as recurring" })).toBeNull();
  });

  it("hides file actions when there are no transactions", async () => {
    await renderScreen({
      transactions: page([], 1, 1),
      categories: [],
    });

    expect(screen.queryByRole("group", { name: "Transaction file actions" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Import transactions" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "New transaction" })).toHaveLength(1);
    expect(screen.queryByPlaceholderText("Search description or notes...")).toBeNull();
  });

  it("renders the no-transactions onboarding state with create and import actions", async () => {
    await renderScreen({
      transactions: page([], 1, 1),
      categories: [],
    });

    const emptyState = screen.getByRole("region", { name: "No transactions yet" });
    const emptyContent = emptyState.querySelector('[data-slot="empty-content"]');

    expect(emptyState.classList.contains("border")).toBe(true);
    expect(emptyState.classList.contains("border-dashed")).toBe(true);
    expect(emptyState.querySelector('[data-slot="empty-icon"]')).not.toBeNull();
    expect(emptyContent?.classList.contains("justify-center")).toBe(true);
    expect(screen.getByRole("heading", { name: "No transactions yet" })).not.toBeNull();
    expect(
      screen.getByText("Add income or an expense to start tracking cash flow."),
    ).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "New transaction" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Import transactions" })).toHaveLength(1);
  });

  it("keeps filters visible when an active filter returns no transactions", async () => {
    transactionState.returnEmptyForQuery = true;

    await renderScreen();
    typeSearchQuery("no-matches");

    await waitFor(() =>
      expect(screen.getByText("No transactions match your filters.")).toBeTruthy(),
    );
    const emptyState = screen.getByRole("region", { name: "No transactions match your filters" });
    const emptyContent = emptyState.querySelector('[data-slot="empty-content"]');
    const clearFiltersButton = emptyState.querySelector("button");

    expect(emptyState.getAttribute("data-slot")).toBe("empty");
    expect(emptyState.classList.contains("border")).toBe(true);
    expect(emptyState.classList.contains("border-dashed")).toBe(true);
    expect(emptyState.querySelector('[data-slot="empty-header"]')).not.toBeNull();
    expect(emptyContent).not.toBeNull();
    expect(clearFiltersButton?.classList.contains("border-border")).toBe(true);
    expect(screen.getByPlaceholderText("Search description or notes...")).toBeTruthy();
  });
});
