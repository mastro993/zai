// @vitest-environment jsdom
import { Result } from "@praha/byethrow";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

import { AlertsLedgerFilters } from "../components/alerts-ledger-filters";
import { AlertsLedgerSheet } from "../components/alerts-ledger-sheet";
import { AlertRow } from "../components/alert-row";
import { AlertsControllerProvider, useAlertsController } from "../hooks/use-alerts-controller";
import { alertsBellLabel, domainAlertSeverityLabel, formatAlertCreatedAt } from "../lib/format";
import { isNavigableAlertDestination, isUnreadAlert, parseDomainAlertListPage } from "../lib/parse";
import type { DomainAlert } from "../types/domain-alert";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

const markAlertRead = vi.fn();
const markAlertUnread = vi.fn();
const markAllAlertsRead = vi.fn();
const getBudget = vi.fn();

vi.mock("../commands/alerts", () => ({
  listAlerts: vi.fn(() =>
    Promise.resolve(
      Result.succeed({
        items: [],
        nextCursor: null,
      }),
    ),
  ),
  getUnreadAlertCount: vi.fn(() => Promise.resolve(Result.succeed(0))),
  markAllAlertsRead: (...args: Array<unknown>) => markAllAlertsRead(...args),
  markAlertRead: (...args: Array<unknown>) => markAlertRead(...args),
  markAlertUnread: (...args: Array<unknown>) => markAlertUnread(...args),
}));

vi.mock("@/features/budgets/commands/budgets", () => ({
  getBudget: (...args: Array<unknown>) => getBudget(...args),
}));

const sampleAlert: DomainAlert = {
  id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  producerKey: "budget.status",
  occurrenceKey: "period-1",
  severity: "warning",
  title: "Budget warning",
  body: "Spending exceeded 80% of allowance.",
  createdAt: "2026-07-14T10:00:00",
  updatedAt: "2026-07-14T10:00:00",
  readAt: null,
};

const budgetDestinationId = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

const budgetAlert: DomainAlert = {
  ...sampleAlert,
  destination: {
    type: "budget",
    budgetId: budgetDestinationId,
  },
};

const readAlert: DomainAlert = {
  ...sampleAlert,
  readAt: "2026-07-14T11:00:00",
};

function success<T>(value: T) {
  return Promise.resolve(Result.succeed(value));
}

function ControllerProbe() {
  const controller = useAlertsController();
  return (
    <div>
      <button type="button" data-testid="open-ledger" onClick={controller.openLedger}>
        Open ledger
      </button>
      <button
        type="button"
        data-testid="toggle-read"
        onClick={() => void controller.toggleAlertReadState(sampleAlert)}
      >
        Toggle read state
      </button>
      <button
        type="button"
        data-testid="open-budget-alert"
        onClick={() => void controller.openAlert(budgetAlert)}
      >
        Open budget alert
      </button>
      <span data-testid="unread-count">{controller.unreadCount}</span>
      <span data-testid="destination-feedback">
        {controller.destinationFeedback?.message ?? ""}
      </span>
      <AlertsLedgerSheet />
    </div>
  );
}

function renderController(ui: ReactNode = <ControllerProbe />) {
  return render(<AlertsControllerProvider>{ui}</AlertsControllerProvider>);
}

describe("domain alert parsing", () => {
  it("accepts canonical list pages and unread state", () => {
    const parsed = parseDomainAlertListPage({
      items: [sampleAlert],
      nextCursor: null,
    });
    expect(parsed?.items).toHaveLength(1);
    expect(isUnreadAlert(sampleAlert)).toBe(true);
  });

  it("labels severities for assistive text", () => {
    expect(domainAlertSeverityLabel("critical")).toBe("Critical");
  });

  it("formats compact creation times", () => {
    expect(formatAlertCreatedAt("2026-07-14T10:00:00")).toMatch(/ago$/);
  });

  it("detects navigable budget destinations", () => {
    expect(isNavigableAlertDestination(budgetAlert.destination)).toBe(true);
    expect(isNavigableAlertDestination(undefined)).toBe(false);
  });
});

describe("alert row rendering", () => {
  it("shows severity text, unread badge, labelled lifecycle action, and immutable copy", () => {
    render(<AlertRow alert={sampleAlert} onToggleReadState={vi.fn()} />);

    screen.getByText("Budget warning");
    screen.getByText("New");
    screen.getByRole("article", { name: /Warning alert/i });
    screen.getByText("Spending exceeded 80% of allowance.");
    screen.getByRole("button", { name: "Mark read: Budget warning" });
    screen.getByText("Unread");
  });

  it("shows mark unread for read alerts", () => {
    render(<AlertRow alert={readAlert} onToggleReadState={vi.fn()} />);

    screen.getByRole("button", { name: "Mark unread: Budget warning" });
    screen.getByText("Read");
  });

  it("renders stale destination feedback without changing alert copy", () => {
    render(
      <AlertRow
        alert={budgetAlert}
        destinationFeedback="This budget is no longer available. The alert history is unchanged."
      />,
    );

    screen.getByRole("button", { name: "Open alert: Budget warning" });
    screen.getByRole("status");
  });
});

describe("alerts bell label", () => {
  it("includes exact unread count in accessible name", () => {
    expect(alertsBellLabel(0)).toBe("Alerts, 0 unread");
    expect(alertsBellLabel(3)).toBe("Alerts, 3 unread");
  });
});

describe("alerts ledger filters", () => {
  it("forwards read and severity changes", () => {
    const onReadStateChange = vi.fn();
    const onSeverityChange = vi.fn();

    render(
      <AlertsLedgerFilters
        filters={{ readState: "all", severity: "all" }}
        onReadStateChange={onReadStateChange}
        onSeverityChange={onSeverityChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unread" }));
    fireEvent.click(screen.getByRole("button", { name: "Critical" }));

    expect(onReadStateChange).toHaveBeenCalledWith("unread");
    expect(onSeverityChange).toHaveBeenCalledWith("critical");
  });
});

describe("alerts controller lifecycle", () => {
  beforeEach(() => {
    markAlertRead.mockReset();
    markAlertUnread.mockReset();
    markAllAlertsRead.mockReset();
    getBudget.mockReset();
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("updates unread count after mark read", async () => {
    markAlertRead.mockResolvedValueOnce(
      success({
        ...sampleAlert,
        readAt: "2026-07-14T11:00:00",
      }),
    );

    renderController();

    fireEvent.click(screen.getByTestId("toggle-read"));

    await waitFor(() => {
      expect(markAlertRead).toHaveBeenCalledWith(sampleAlert.id);
    });
  });

  it("marks unread alert read before budget navigation", async () => {
    markAlertRead.mockResolvedValueOnce(
      success({
        ...budgetAlert,
        readAt: "2026-07-14T11:00:00",
      }),
    );
    getBudget.mockResolvedValueOnce(
      success({
        id: budgetDestinationId,
        name: "Groceries",
      }),
    );

    renderController();

    fireEvent.click(screen.getByTestId("open-budget-alert"));

    await waitFor(() => {
      expect(markAlertRead).toHaveBeenCalledWith(budgetAlert.id);
      expect(getBudget).toHaveBeenCalledWith(budgetDestinationId);
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/cash-flow/budgets/$budgetId",
        params: { budgetId: budgetDestinationId },
      });
    });
  });

  it("keeps alert read and shows feedback when budget destination is stale", async () => {
    markAlertRead.mockResolvedValueOnce(
      success({
        ...budgetAlert,
        readAt: "2026-07-14T11:00:00",
      }),
    );
    getBudget.mockResolvedValueOnce(
      Promise.resolve(
        Result.fail({
          code: "notFound",
          message: "Failed to load budget: Not found: budget",
        }),
      ),
    );

    renderController();

    fireEvent.click(screen.getByTestId("open-budget-alert"));

    await waitFor(() => {
      expect(screen.getByTestId("destination-feedback").textContent).toBe(
        "This budget is no longer available. The alert history is unchanged.",
      );
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("disables mark all read when no unread alerts remain", async () => {
    renderController();

    fireEvent.click(screen.getByTestId("open-ledger"));

    await waitFor(() => {
      const markAll = screen.getByRole("button", { name: "Mark all read" }) as HTMLButtonElement;
      expect(markAll.disabled).toBe(true);
    });
    expect(markAllAlertsRead).not.toHaveBeenCalled();
  });
});
