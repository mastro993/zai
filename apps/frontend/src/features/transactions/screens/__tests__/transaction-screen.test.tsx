// @vitest-environment jsdom

import { cleanup, act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/screen-base", () => ({
  ScreenBase: ({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) => (
    <div>
      <div>{actions}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/components/toaster/toast", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => (
    <a href={props.to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/use-screen-breadcrumbs", () => ({
  useScreenBreadcrumbs: () => [{ label: "Transactions" }],
}));

vi.mock("@/features/alerts/components/alerts-bell", () => ({
  AlertsBell: () => null,
}));

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

vi.mock("../../components/transaction-import-dialog", () => ({
  TransactionImportDialog: ({
    onImported,
  }: {
    onImported: (createdCount: number, skippedRows: number) => Promise<void>;
  }) => (
    <button type="button" onClick={() => void onImported(1, 0)}>
      Trigger import refresh
    </button>
  ),
}));

const transactionState = vi.hoisted(() => ({
  releaseStale: undefined as undefined | (() => void),
  releaseCurrent: undefined as undefined | (() => void),
  holdStale: false,
  holdCurrent: false,
  returnEmptyOnPage2: false,
}));

vi.mock("../../commands/transactions", async () => {
  const { Result: ResultModule } = await import("@praha/byethrow");
  const { CommandError: ErrorClass } = await import("@/commands/errors");

  return {
    createTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    deleteTransactions: vi.fn(),
    getFilteredTransactionIds: vi.fn(),
    exportTransactionsCsv: vi.fn(),
    findExistingDuplicateKeys: vi.fn(),
    getTransactions: vi.fn((page, perPage, filters) => {
      const query = filters?.query ?? "";

      if (query === "stale") {
        if (transactionState.holdStale) {
          return new Promise((resolve) => {
            transactionState.releaseStale = () =>
              resolve(
                ResultModule.succeed({
                  data: [
                    {
                      id: "tx-stale",
                      description: "Stale rent",
                      amount: 120000,
                      transactionDate: "2026-07-02T10:00:00",
                      transactionType: "expense",
                      transactionCategoryId: null,
                      notes: null,
                    },
                  ],
                  page: 1,
                  perPage: 50,
                  totalPages: 1,
                }),
              );
          });
        }
      }

      if (query === "current") {
        if (transactionState.holdCurrent) {
          return new Promise((resolve) => {
            transactionState.releaseCurrent = () =>
              resolve(
                ResultModule.succeed({
                  data: [
                    {
                      id: "tx-current",
                      description: "Fresh salary",
                      amount: 250000,
                      transactionDate: "2026-07-03T10:00:00",
                      transactionType: "income",
                      transactionCategoryId: null,
                      notes: null,
                    },
                  ],
                  page: 1,
                  perPage: 50,
                  totalPages: 1,
                }),
              );
          });
        }

        return Promise.resolve(
          ResultModule.succeed({
            data: [
              {
                id: "tx-current",
                description: "Fresh salary",
                amount: 250000,
                transactionDate: "2026-07-03T10:00:00",
                transactionType: "income",
                transactionCategoryId: null,
                notes: null,
              },
            ],
            page: 1,
            perPage: 50,
            totalPages: 1,
          }),
        );
      }

      if (query === "stale-fail") {
        if (transactionState.holdStale) {
          return new Promise((resolve) => {
            transactionState.releaseStale = () =>
              resolve(ResultModule.fail(new ErrorClass("stale request failed")));
          });
        }
      }

      if (query === "empty-page" && page === 2) {
        return Promise.resolve(
          ResultModule.succeed({
            data: [],
            page: 2,
            perPage: 50,
            totalPages: 2,
          }),
        );
      }

      if (page === 2 && transactionState.returnEmptyOnPage2) {
        return Promise.resolve(
          ResultModule.succeed({
            data: [],
            page: 2,
            perPage: 50,
            totalPages: 2,
          }),
        );
      }

      if (page === 2 && !query && transactionState.holdStale) {
        return new Promise((resolve) => {
          transactionState.releaseStale = () =>
            resolve(
              ResultModule.succeed({
                data: [],
                page: 2,
                perPage: 50,
                totalPages: 2,
              }),
            );
        });
      }

      return Promise.resolve(
        ResultModule.succeed({
          data: [
            {
              id: "tx-initial",
              description: "Initial coffee",
              amount: 350,
              transactionDate: "2026-07-01T10:00:00",
              transactionType: "expense",
              transactionCategoryId: null,
              notes: null,
            },
          ],
          page,
          perPage,
          totalPages: 2,
        }),
      );
    }),
    updateTransaction: vi.fn(),
  };
});

vi.mock("@/features/categories/commands/transaction-categories", async () => {
  const { Result: ResultModule } = await import("@praha/byethrow");

  return {
    getTransactionCategories: vi.fn(() =>
      Promise.resolve(
        ResultModule.succeed([
          {
            id: "cat-2",
            parentId: null,
            name: "Imported category",
            description: null,
            color: "#147B1E",
            role: "spending",
          },
        ]),
      ),
    ),
  };
});

import { toast } from "@/components/toaster/toast";

import * as transactionCategories from "@/features/categories/commands/transaction-categories";
import * as transactions from "../../commands/transactions";
import { TransactionScreen } from "../transaction-screen";

const initialData = {
  transactions: {
    data: [
      {
        id: "tx-initial",
        description: "Initial coffee",
        amount: 350,
        transactionDate: "2026-07-01T10:00:00",
        transactionType: "expense",
        transactionCategoryId: null,
        notes: null,
      },
    ],
    page: 1,
    perPage: 50,
    totalPages: 2,
  },
  categories: [
    {
      id: "cat-1",
      parentId: null,
      name: "Food",
      description: null,
      color: "#951818",
      role: "spending" as const,
    },
  ],
};

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
    transactionState.returnEmptyOnPage2 = false;
    transactionState.releaseStale = undefined;
    transactionState.releaseCurrent = undefined;
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
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const renderScreen = () => render(<TransactionScreen initialData={initialData} />);

  it("ignores older success after a newer success", async () => {
    transactionState.holdStale = true;

    renderScreen();
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

    renderScreen();
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

    renderScreen();
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

    renderScreen();
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

    renderScreen();

    goToNextPage();

    await waitFor(() =>
      expect(transactions.getTransactions).toHaveBeenLastCalledWith(1, 50, undefined),
    );
  });

  it("loads categories after import refresh", async () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Trigger import refresh" }));

    await waitFor(() => expect(transactionCategories.getTransactionCategories).toHaveBeenCalled());
  });

  it("debounces search before issuing a request", async () => {
    renderScreen();

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

  it("toasts when a transaction is created", async () => {
    const { Result: ResultModule } = await import("@praha/byethrow");
    vi.mocked(transactions.createTransaction).mockResolvedValue(
      ResultModule.succeed({
        id: "tx-new",
        description: null,
        amount: 0,
        transactionDate: "2026-07-15T10:00:00",
        transactionType: "expense",
        transactionCategoryId: null,
        notes: null,
      }),
    );

    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "New transaction" }));
    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Transaction created"));
  });

  it("disables export when there are no transactions to export", () => {
    render(
      <TransactionScreen
        initialData={{
          transactions: { data: [], page: 1, perPage: 50, totalPages: 1 },
          categories: [],
        }}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Export transactions" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
