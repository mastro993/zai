// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}));

const documentFixture = {
  recurringTransaction: {
    id: "rt-1",
    lifecycle: "active" as const,
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
    rule: { type: "interval" as const, every: 1, unit: "month" as const },
  },
  template: {
    id: "tmpl-1",
    recurringTransactionId: "rt-1",
    sequence: 1,
    effectiveFromLocal: "2026-08-01T09:00:00",
    amount: 120000,
    transactionType: "expense" as const,
    description: "Monthly rent",
  },
  occurrenceSummary: {
    fulfilledCount: 1,
    totalOccurrences: 12,
    nextScheduledLocal: "2026-09-01T09:00:00",
    needsAttention: false,
  },
  links: {
    state: "ready" as const,
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
          fulfillmentKind: "adopted" as const,
          recurringAlertId: null,
        },
      ],
    },
  },
  failures: { state: "empty" as const, history: { items: [] } },
  budgetImpact: {
    state: "unavailable" as const,
    message: "Budget impact will appear once forecast projections are available.",
  },
};

vi.mock("@/features/recurring-transactions/commands/recurring-transactions", async () => {
  const { Result } = await import("@praha/byethrow");
  return {
    getRecurringTransactions: vi.fn(() =>
      Promise.resolve(
        Result.succeed({
          items: [
            {
              recurringTransaction: documentFixture.recurringTransaction,
              description: "Monthly rent",
              nextScheduledLocal: "2026-09-01T09:00:00",
              needsAttention: false,
            },
          ],
          nextCursor: null,
        }),
      ),
    ),
    getRecurringTransaction: vi.fn(() => Promise.resolve(Result.succeed(documentFixture))),
    getRecurringTransactionOccurrences: vi.fn(() =>
      Promise.resolve(Result.succeed(documentFixture.links.occurrences)),
    ),
    createRecurringTransaction: vi.fn(() =>
      Promise.resolve(Result.succeed({ outcome: "succeeded", document: documentFixture })),
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

describe("recurring screen navigation", () => {
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

  it("shows the occurrence-card feed and create control", async () => {
    await renderPath("/cash-flow/recurring");
    expect(await screen.findByRole("heading", { name: "Recurring transactions" })).toBeTruthy();
    expect(screen.getByRole("feed", { name: "Recurring transactions" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Monthly rent" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New recurring" })).toBeTruthy();
    expect(screen.getByLabelText(/Monthly rent, Active/)).toBeTruthy();
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
    expect(screen.getByText("Back to feed")).toBeTruthy();
  });
});
