// @vitest-environment jsdom

import { Result } from "@praha/byethrow";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";
import {
  ApplicationTitleBar,
  ApplicationTitleBarProvider,
} from "@/components/application-title-bar";
import { SidebarProvider } from "@/components/ui/sidebar";
import * as alertsController from "@/features/alerts/hooks/use-alerts-controller";
import type { AlertsControllerValue } from "@/features/alerts/hooks/alerts-controller-context";
import * as currencyCommands from "@/features/currency/commands/currency";
import * as currencyEvents from "@/features/currency/commands/currency-state-events";
import { CurrencyBootstrapProvider } from "@/features/currency/hooks/use-currency-bootstrap";
import * as breadcrumbs from "@/hooks/use-screen-breadcrumbs";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";

import * as transactions from "../../commands/transactions";
import { sampleTransaction } from "../../types/sample";
import { TransactionDetailScreen } from "../transaction-detail-screen";

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

const pendingUsd = sampleTransaction({
  id: "tx-pending",
  description: "Hotel",
  amount: 10000,
  currency: "USD",
  transactionDate: "2026-07-01T10:00:00",
  complete: false,
  convertedAmount: null,
  convertedCurrency: "EUR",
  exchangeRate: {
    variant: "pending",
    rateDate: "2026-07-01",
    sourceCurrency: "USD",
    referenceCurrency: "EUR",
    origin: "supplied",
  },
});

const completeUsd = sampleTransaction({
  id: "tx-pending",
  description: "Hotel",
  amount: 10000,
  currency: "USD",
  transactionDate: "2026-07-01T10:00:00",
  complete: true,
  convertedAmount: 9200,
  convertedCurrency: "EUR",
  exchangeRate: {
    variant: "manual",
    rateDate: "2026-07-01",
    sourceCurrency: "USD",
    referenceCurrency: "EUR",
    originalDecimal: "0.92",
    origin: "manual",
  },
});

async function renderDetail(transaction = pendingUsd) {
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
        <TransactionDetailScreen
          transaction={transaction}
          categories={[]}
          recurringProvenance={null}
        />
      </CurrencyBootstrapProvider>
    ),
  });
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/transactions",
    component: () => <div>Transactions</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, listRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("TransactionDetailScreen pending recovery", () => {
  beforeEach(() => {
    vi.spyOn(breadcrumbs, "useScreenBreadcrumbs").mockReturnValue([{ label: "Transaction" }]);
    vi.spyOn(alertsController, "useAlertsController").mockReturnValue(idleAlertsController);
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
      Result.succeed([
        { code: "EUR", name: "Euro" },
        { code: "USD", name: "US Dollar" },
      ]),
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
        {
          code: "USD",
          name: "US Dollar",
          status: "enabled",
          coverageFrom: null,
          coverageTo: null,
          lastRefresh: null,
          refreshStatus: "idle",
          missingPeriods: [],
          usedByRecurring: false,
          isDefault: false,
        },
      ]),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows converted amount first and original money on a muted second line", async () => {
    await renderDetail(
      sampleTransaction({
        id: "tx-usd",
        description: "Hotel",
        amount: 10000,
        currency: "USD",
        convertedAmount: 9200,
        convertedCurrency: "EUR",
        exchangeRate: {
          variant: "automatic",
          rateDate: "2026-07-01",
          sourceCurrency: "USD",
          referenceCurrency: "EUR",
          originalDecimal: "0.92",
          origin: "supplied",
        },
      }),
    );

    expect(screen.queryByText("Incomplete")).toBeNull();
    expect(screen.getByText(/0.92/)).toBeTruthy();
    expect(screen.getByText(/Supplied/)).toBeTruthy();
  });

  it("rounds a long conversion rate to six fractional digits", async () => {
    await renderDetail(
      sampleTransaction({
        id: "tx-jpy",
        description: "Suica",
        amount: 1000,
        currency: "JPY",
        convertedAmount: 536,
        convertedCurrency: "EUR",
        exchangeRate: {
          variant: "automatic",
          rateDate: "2026-07-01",
          sourceCurrency: "JPY",
          referenceCurrency: "EUR",
          originalDecimal: "0.00536193",
          origin: "supplied",
        },
      }),
    );

    expect(screen.getByText(/0.005362/)).toBeTruthy();
    expect(screen.queryByText(/0.00536193/)).toBeNull();
  });

  it("retries a pending rate lookup", async () => {
    vi.spyOn(transactions, "updateTransaction").mockResolvedValue(Result.succeed(completeUsd));

    await renderDetail();

    expect(screen.getByText("Incomplete")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(transactions.updateTransaction).toHaveBeenCalled());
    expect(vi.mocked(transactions.updateTransaction).mock.calls[0]?.[2]).toEqual({
      retryRateLookup: true,
    });
  });

  it("enters a manual recovery rate", async () => {
    vi.spyOn(transactions, "updateTransaction").mockResolvedValue(Result.succeed(completeUsd));

    await renderDetail();

    fireEvent.change(screen.getByLabelText("Manual recovery rate"), { target: { value: "0.92" } });
    fireEvent.click(screen.getByRole("button", { name: "Enter rate" }));

    await waitFor(() => expect(transactions.updateTransaction).toHaveBeenCalled());
    expect(vi.mocked(transactions.updateTransaction).mock.calls[0]?.[1].manualExchangeRate).toBe(
      "0.92",
    );
  });

  it("asks before replacing a manual rate", async () => {
    vi.spyOn(transactions, "updateTransaction").mockResolvedValueOnce(
      Result.fail(
        new CommandError("Confirm replacement", { code: "manualRateReplacementRequired" }),
      ),
    );

    await renderDetail(completeUsd);
    fireEvent.click(screen.getByRole("button", { name: "Edit transaction" }));
    await waitFor(() => expect(screen.getByLabelText("Conversion rate")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Conversion rate"), { target: { value: "0.95" } });
    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }));

    await waitFor(() =>
      expect(screen.getByText("Replace the current exchange rate?")).toBeTruthy(),
    );
  });
});
