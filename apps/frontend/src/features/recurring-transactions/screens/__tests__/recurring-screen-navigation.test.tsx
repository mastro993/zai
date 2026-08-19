// @vitest-environment jsdom

import { Result } from "@praha/byethrow";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
import * as currencyCommands from "@/features/currency/commands/currency";
import * as currencyEvents from "@/features/currency/commands/currency-state-events";
import { CurrencyBootstrapProvider } from "@/features/currency/hooks/use-currency-bootstrap";
import * as alertsController from "@/features/alerts/hooks/use-alerts-controller";
import type { AlertsControllerValue } from "@/features/alerts/hooks/alerts-controller-context";
import { sampleTransaction } from "@/features/transactions/types/sample";
import { TransactionDetailScreen } from "@/features/transactions/screens/transaction-detail-screen";
import * as breadcrumbs from "@/hooks/use-screen-breadcrumbs";

import { RecurringSelectionProvider } from "../../hooks/recurring-selection-context";
import * as processingEvents from "../../commands/recurring-processing-events";
import * as recurringCommands from "../../commands/recurring-transactions";
import type {
  RecurringFeedItem,
  RecurringTransactionDocument,
  TransactionRecurringProvenance,
} from "../../types/recurring-transaction";
import { RecurringDocumentScreen } from "../recurring-document-screen";
import { RecurringScreen } from "../recurring-screen";

const documentFixture: RecurringTransactionDocument = {
  recurringTransaction: {
    id: "rt-1",
    lifecycle: "active",
    totalOccurrences: 12,
    fulfilledCount: 1,
    revision: 1,
    lifecycleChangedAt: "2026-07-21T10:00:00",
    createdAt: "2026-07-21T10:00:00",
    updatedAt: "2026-07-21T10:00:00",
  },
  schedule: {
    id: "sched-1",
    recurringTransactionId: "rt-1",
    sequence: 1,
    effectiveFromLocal: "2026-08-01T09:00:00",
    firstScheduledLocal: "2026-08-01T09:00:00",
    rule: { type: "interval", every: 1, unit: "month" },
  },
  template: {
    id: "tmpl-1",
    recurringTransactionId: "rt-1",
    sequence: 1,
    effectiveFromLocal: "2026-08-01T09:00:00",
    amount: 120000,
    currency: "EUR",
    transactionType: "expense",
    description: "Monthly rent",
  },
  occurrenceSummary: {
    fulfilledCount: 1,
    totalOccurrences: 12,
    nextScheduledLocal: "2026-09-01T09:00:00",
    needsAttention: false,
  },
  links: {
    state: "ready",
    occurrences: {
      items: [
        {
          recurringTransactionId: "rt-1",
          scheduleRevisionId: "sched-1",
          ordinal: 1,
          scheduledLocal: "2026-08-01T09:00:00",
          templateRevisionId: "tmpl-1",
          fulfilledAt: "2026-08-01T09:00:00",
          fulfillmentPosition: 1,
          transactionId: "txn-1",
          fulfillmentKind: "adopted",
          recurringAlertId: null,
        },
      ],
    },
  },
  failures: { state: "empty", waitingCount: 0, history: { items: [] } },
  budgetImpact: {
    state: "ready",
    projection: {
      observedLocal: "2026-08-05T12:00:00",
      throughLocal: "2026-11-05T12:00:00",
      horizonMonths: 3,
      complete: false,
      currency: "EUR",
      sourceErrors: [
        {
          kind: "generationBlocked",
          recurringTransactionId: "rt-1",
          message: "Generation-blocked source excluded from projection",
        },
      ],
      periods: [
        {
          budgetId: "budget-1",
          budgetName: "Household",
          periodStart: "2026-09-01T00:00:00",
          periodEnd: "2026-10-01T00:00:00",
          cadence: "month",
          measurementMode: "spending",
          rolloverMode: "off",
          baseAllowance: 200000,
          actualNetBudgetSpending: 80000,
          projectedDelta: 120000,
          forecastNetBudgetSpending: 200000,
          effectiveAllowance: 200000,
          remainingAllowance: 0,
          status: null,
          partial: false,
          coveredUntil: "2026-10-01T00:00:00",
          attribution: [
            {
              recurringTransactionId: "rt-1",
              scheduleRevisionId: "sched-1",
              ordinal: 2,
              scheduledLocal: "2026-09-01T09:00:00",
              description: "Monthly rent",
              contribution: 120000,
            },
          ],
        },
        {
          budgetId: "budget-1",
          budgetName: "Household",
          periodStart: "2026-11-01T00:00:00",
          periodEnd: "2026-12-01T00:00:00",
          cadence: "month",
          measurementMode: "spending",
          rolloverMode: "off",
          baseAllowance: 200000,
          actualNetBudgetSpending: 0,
          projectedDelta: 0,
          forecastNetBudgetSpending: 0,
          effectiveAllowance: 200000,
          remainingAllowance: 200000,
          status: null,
          partial: true,
          coveredUntil: "2026-11-05T12:00:00",
          attribution: [],
        },
      ],
    },
  },
};

const feedItem: RecurringFeedItem = {
  recurringTransaction: documentFixture.recurringTransaction,
  description: "Monthly rent",
  nextScheduledLocal: "2026-09-01T09:00:00",
  needsAttention: false,
};

const transaction = sampleTransaction({
  id: "txn-1",
  description: "Monthly rent",
  amount: 120000,
  transactionDate: "2026-08-01T09:00:00",
  transactionType: "expense",
  transactionCategoryId: null,
  notes: null,
});

interface ProvenanceState {
  sourceVisible: boolean;
}

interface FeedState {
  empty: boolean;
}

const provenanceState: ProvenanceState = { sourceVisible: true };
const feedState: FeedState = { empty: false };

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

function currentProvenance(): TransactionRecurringProvenance {
  return {
    occurrence: documentFixture.links.occurrences.items[0],
    source: provenanceState.sourceVisible
      ? {
          id: "rt-1",
          description: "Monthly rent",
          lifecycle: "active",
        }
      : undefined,
  };
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

async function renderPath(pathname: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <CurrencyBootstrapProvider>
        <SidebarProvider>
          <ApplicationTitleBarProvider>
            <ApplicationTitleBar buildTarget="web" />
            <Outlet />
          </ApplicationTitleBarProvider>
        </SidebarProvider>
      </CurrencyBootstrapProvider>
    ),
  });
  const feedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/recurring/",
    component: () => (
      <RecurringSelectionProvider>
        <RecurringScreen
          initialItems={feedState.empty ? [] : [feedItem]}
          initialNextCursor={null}
          categories={[]}
        />
      </RecurringSelectionProvider>
    ),
  });
  const documentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/recurring/$recurringTransactionId",
    component: () => <RecurringDocumentScreen document={documentFixture} categories={[]} />,
  });
  const transactionRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/transactions/$transactionId",
    component: () => (
      <TransactionDetailScreen
        transaction={transaction}
        categories={[]}
        recurringProvenance={currentProvenance()}
      />
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([feedRoute, documentRoute, transactionRoute]),
    history: createMemoryHistory({ initialEntries: [pathname] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
  return router;
}

describe("recurring screen navigation", () => {
  beforeEach(() => {
    stubWindowChrome();
    provenanceState.sourceVisible = true;
    feedState.empty = false;
    vi.spyOn(breadcrumbs, "useScreenBreadcrumbs").mockReturnValue([{ label: "Recurring" }]);
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
    vi.spyOn(processingEvents, "createRecurringProcessingEventTransport").mockReturnValue({
      subscribe: () => ({
        ready: Promise.resolve(Result.succeed(undefined)),
        close: () => undefined,
      }),
    });
    vi.spyOn(recurringCommands, "getRecurringTransactions").mockImplementation(async () =>
      Result.succeed({
        items: feedState.empty ? [] : [feedItem],
        nextCursor: null,
        filterFingerprint: "fp",
      }),
    );
    vi.spyOn(recurringCommands, "getRecurringProcessingStatus").mockResolvedValue(
      Result.succeed({ status: "idle" }),
    );
    vi.spyOn(recurringCommands, "getRecurringTransactionOccurrences").mockResolvedValue(
      Result.succeed(documentFixture.links.occurrences),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the occurrence-card feed and create control", async () => {
    await renderPath("/cash-flow/recurring");
    expect(await screen.findByRole("feed", { name: "Recurring transactions" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Monthly rent" })).toBeTruthy();
    expect((await screen.findByRole("button", { name: "New recurring" })).className).toContain(
      "h-7",
    );
    expect(screen.getByLabelText(/Monthly rent, Active/)).toBeTruthy();
  });

  it("shows the shared first-use empty state without list controls", async () => {
    feedState.empty = true;
    await renderPath("/cash-flow/recurring");

    expect(
      await screen.findByRole("heading", { name: "No recurring transactions yet" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Create your first recurring transaction to start scheduling cash flow."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "New recurring" })).toBeTruthy();
    expect(screen.queryByLabelText("Recurring transaction filters")).toBeNull();
    expect(screen.queryByRole("heading", { name: /^Recurring transactions$/ })).toBeNull();
    expect(screen.queryByText("Create schedules and browse upcoming occurrence cards.")).toBeNull();
  });

  it("opens the full-bleed document with required sections", async () => {
    await renderPath("/cash-flow/recurring/rt-1");
    expect(await screen.findByRole("heading", { name: "Monthly rent" })).toBeTruthy();
    expect(screen.getByLabelText("Identity")).toBeTruthy();
    expect(screen.getByLabelText("Schedule")).toBeTruthy();
    expect(screen.getByLabelText("Template")).toBeTruthy();
    expect(screen.getByLabelText("Lifecycle")).toBeTruthy();
    expect(screen.getByLabelText("Occurrence summary")).toBeTruthy();
    expect(screen.getByLabelText("Links")).toBeTruthy();
    expect(screen.getByText(/Adopted/)).toBeTruthy();
    expect(screen.getByLabelText("Failures")).toBeTruthy();
    expect(screen.getByLabelText("Budget impact")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Recurring budget impact by period" })).toBeTruthy();
    expect(screen.getByText("Projected change")).toBeTruthy();
    expect(screen.getByText("Combined forecast")).toBeTruthy();
    expect(screen.getByText("Forecast incomplete")).toBeTruthy();
    expect(screen.getAllByText("Partial through 2026-11-05")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Open recurring source for Monthly rent" }),
    ).toBeTruthy();
    expect(screen.getByText("Back to feed")).toBeTruthy();
  });

  it("opens exact occurrence transaction and links back to its source", async () => {
    const router = await renderPath("/cash-flow/recurring/rt-1");
    const occurrenceLink = screen.getByRole("link", {
      name: "Open adopted transaction for occurrence 1 of Monthly rent",
    });

    expect(occurrenceLink).toBeInstanceOf(HTMLAnchorElement);
    if (!(occurrenceLink instanceof HTMLAnchorElement)) return;
    expect(occurrenceLink.getAttribute("href")).toBe("/cash-flow/transactions/txn-1");
    fireEvent.click(occurrenceLink);

    expect(await screen.findByRole("heading", { name: "Monthly rent" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/cash-flow/transactions/txn-1");
    expect(screen.getByRole("link", { name: "Open recurring source Monthly rent" })).toBeTruthy();

    await router.history.back();
    expect(await screen.findByRole("heading", { name: "Monthly rent" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/cash-flow/recurring/rt-1");
  });

  it("does not expose a tombstoned source from retained transaction provenance", async () => {
    provenanceState.sourceVisible = false;
    await renderPath("/cash-flow/transactions/txn-1");

    expect(await screen.findByRole("heading", { name: "Monthly rent" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Open recurring source/ })).toBeNull();
    expect(screen.queryByText("rt-1")).toBeNull();
  });
});
