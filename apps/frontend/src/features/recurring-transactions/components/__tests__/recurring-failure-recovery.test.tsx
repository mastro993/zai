// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Result } from "@praha/byethrow";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RecurringTransactionDocument } from "../../types/recurring-transaction";
import type {
  RecurringFailurePage,
  RecurringGenerationFailure,
} from "../../types/recurring-failure";
import { RecurringFailureBanner } from "../recurring-failure-banner";
import { RecurringFailureHistory } from "../recurring-failure-history";

const commandMocks = vi.hoisted(() => ({
  getRecurringTransactionFailureHistory: vi.fn(),
  previewRecurringGenerationRepair: vi.fn(),
  repairRecurringGenerationFailure: vi.fn(),
  retryRecurringGenerationFailure: vi.fn(),
  getRecurringGenerationFailureDiagnostics: vi.fn(),
}));

vi.mock("@/features/recurring-transactions/commands/recurring-transactions", async () => {
  const actual = await vi.importActual(
    "@/features/recurring-transactions/commands/recurring-transactions",
  );
  return { ...(actual as object), ...commandMocks };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const resolvedFailure = {
  recurringTransactionId: "rt-1",
  scheduleRevisionId: "schedule-1",
  ordinal: 2,
  errorCode: "invalid_category",
  causeCategory: "template",
  repairFieldKey: "transactionCategoryId",
  correlationId: "correlation-1",
  failedScheduledLocal: "2026-07-21T10:00:00",
  firstFailedAt: "2026-07-21T10:01:00",
  lastFailedAt: "2026-07-21T10:02:00",
  attemptCount: 2,
  repairedAt: "2026-07-21T10:03:00",
  repairRevision: 2,
  resolvedAt: "2026-07-21T10:04:00",
  resolutionKind: "fulfilled",
  generationFailureAlertId: "alert-1",
} satisfies RecurringGenerationFailure;

function failurePage(
  items: Array<RecurringGenerationFailure>,
  nextCursor?: string,
): RecurringFailurePage {
  return { items, nextCursor };
}

function documentWithFailure(): RecurringTransactionDocument {
  return {
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
      id: "schedule-1",
      recurringTransactionId: "rt-1",
      sequence: 1,
      effectiveFromLocal: "2026-07-01T10:00:00",
      firstScheduledLocal: "2026-07-01T10:00:00",
      rule: { type: "interval", every: 1, unit: "month" },
    },
    template: {
      id: "template-1",
      recurringTransactionId: "rt-1",
      sequence: 1,
      effectiveFromLocal: "2026-07-01T10:00:00",
      description: "Monthly rent",
      amount: 120000,
      transactionType: "expense",
    },
    occurrenceSummary: {
      fulfilledCount: 1,
      totalOccurrences: 12,
      nextScheduledLocal: "2026-07-21T10:00:00",
      needsAttention: true,
    },
    links: { state: "empty", occurrences: { items: [] } },
    failures: {
      state: "ready",
      unresolved: {
        ...resolvedFailure,
        repairedAt: null,
        repairRevision: null,
        resolvedAt: null,
        resolutionKind: null,
      },
      waitingCount: 4,
      nextAction: "repair",
      history: failurePage([]),
    },
    budgetImpact: { state: "unavailable", message: "Unavailable" },
  };
}

describe("RecurringFailureHistory", () => {
  it("stays collapsed, exposes accessible state, and loads cursor pages", async () => {
    const nextFailure = { ...resolvedFailure, ordinal: 1 };
    commandMocks.getRecurringTransactionFailureHistory.mockResolvedValue(
      Result.succeed(failurePage([nextFailure])),
    );

    render(
      <RecurringFailureHistory
        recurringTransactionId="rt-1"
        initialPage={failurePage([resolvedFailure], "cursor-2")}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Show resolved failure history" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Template problem")).toBeNull();

    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "Resolved failure history" })).toBeTruthy();
    expect(screen.getByText(/Template problem ·/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Load more resolved failures" }));
    await waitFor(() => {
      expect(commandMocks.getRecurringTransactionFailureHistory).toHaveBeenCalledWith(
        "rt-1",
        20,
        "cursor-2",
      );
    });
    expect(screen.getAllByText(/Template problem/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Load more resolved failures" })).toBeNull();
  });
});

describe("RecurringFailureBanner", () => {
  it("exposes redacted failure details, previews proposed value, and returns focus", async () => {
    commandMocks.previewRecurringGenerationRepair.mockResolvedValue(
      Result.succeed({
        repairFieldKey: "transactionCategoryId",
        affectedUnfulfilledSegmentCount: 3,
        includesFutureTemplate: true,
        nextAction: "repair",
      }),
    );

    const document = documentWithFailure();
    render(
      <RecurringFailureBanner document={document} categories={[]} onDocumentChange={vi.fn()} />,
    );

    const banner = screen.getByRole("status", { name: "Needs attention" });
    expect(banner.getAttribute("aria-label")).toBe("Generation needs attention");
    expect(screen.getByText("Template problem")).toBeTruthy();
    expect(screen.getByText("Waiting later due").nextElementSibling?.textContent).toBe("4");
    expect(screen.getByText("Category")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry now" })).toBeNull();

    const repairButton = screen.getByRole("button", { name: "Repair" });
    fireEvent.click(repairButton);
    const previewButton = screen.getByRole("button", { name: "Preview repair" });
    fireEvent.submit(previewButton.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("Proposed category:")).toBeTruthy();
      expect(screen.getAllByText("Uncategorized")).toHaveLength(2);
      expect(screen.getByText(/updates 3 unfulfilled segments/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(window.document.activeElement).toBe(repairButton);
    });
  });
});
