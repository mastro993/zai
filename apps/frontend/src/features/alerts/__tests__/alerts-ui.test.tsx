// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AlertRow } from "../components/alert-row";
import { alertsBellLabel, domainAlertSeverityLabel, formatAlertCreatedAt } from "../lib/format";
import { isUnreadAlert, parseDomainAlertListPage } from "../lib/parse";
import type { DomainAlert } from "../types/domain-alert";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

const sampleAlert: DomainAlert = {
  id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  producerKey: "budget.status",
  occurrenceKey: "period-1",
  severity: "warning",
  title: "Budget warning",
  body: "Spending exceeded 80% of allowance.",
  createdAt: "2026-07-14T10:00:00",
  readAt: null,
};

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
});

describe("alert row rendering", () => {
  it("shows severity text, unread badge, and immutable copy", () => {
    render(<AlertRow alert={sampleAlert} />);

    screen.getByText("Budget warning");
    screen.getByText("New");
    screen.getByRole("article", { name: /Warning alert/i });
    screen.getByText("Spending exceeded 80% of allowance.");
  });
});

describe("alerts bell label", () => {
  it("includes exact unread count in accessible name", () => {
    expect(alertsBellLabel(0)).toBe("Alerts, 0 unread");
    expect(alertsBellLabel(3)).toBe("Alerts, 3 unread");
  });
});
