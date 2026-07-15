// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

import { AlertRow } from "../components/alert-row";
import type { DomainAlert } from "../types/domain-alert";

afterEach(() => {
  cleanup();
});

const baseAlert: DomainAlert = {
  id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  producerKey: "budget.status",
  occurrenceKey: "period-1",
  severity: "critical",
  title: "Groceries is overspent",
  body: "Net budget spending exceeded the effective allowance for the budget period starting 2026-07-01.",
  createdAt: "2026-07-14T10:00:00",
  readAt: null,
  destination: {
    type: "budget",
    budgetId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  },
  data: {
    kind: "budget.status",
    version: 1,
    payload: {
      status: "overspent",
      periodStart: "2026-07-01T00:00:00",
      periodEnd: "2026-08-01T00:00:00",
      effectiveAllowance: 100_000,
      netBudgetSpending: 150_000,
      remainingAllowance: -50_000,
      currency: "EUR",
    },
  },
};

describe("budget status alert renderer", () => {
  it("renders compact monetary and period snapshot for valid v1 payload", () => {
    render(<AlertRow alert={baseAlert} />);

    screen.getByText("Overspent");
    screen.getByText("Period 2026-07-01 to 2026-08-01");
    screen.getByText("Effective allowance");
    screen.getByText("Net budget spending");
    screen.getByText("Remaining allowance");
    screen.getByText("Groceries is overspent");
    screen.getByText(
      "Net budget spending exceeded the effective allowance for the budget period starting 2026-07-01.",
    );
  });

  it("omits rich section for unknown versions while keeping title and body", () => {
    render(
      <AlertRow
        alert={{
          ...baseAlert,
          data: {
            kind: "budget.status",
            version: 2,
            payload: baseAlert.data?.payload ?? {},
          },
        }}
      />,
    );

    expect(screen.queryByText("Effective allowance")).toBeNull();
    screen.getByText("Groceries is overspent");
  });

  it("omits rich section for malformed payload while keeping navigation title", () => {
    render(
      <AlertRow
        alert={{
          ...baseAlert,
          data: {
            kind: "budget.status",
            version: 1,
            payload: { status: "overspent" },
          },
        }}
      />,
    );

    expect(screen.queryByText("Period 2026-07-01 to 2026-08-01")).toBeNull();
    screen.getByRole("button", { name: "Open alert: Groceries is overspent" });
  });
});
