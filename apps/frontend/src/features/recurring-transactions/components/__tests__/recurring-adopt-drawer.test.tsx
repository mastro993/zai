// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { Drawer } from "@/components/ui/drawer";
import type { CommandError } from "@/commands/errors";

import { RecurringAdoptDrawer } from "../recurring-adopt-drawer";
import type {
  AdoptRecurringFormValues,
  RecurringAdoptOutcome,
  RecurringTransactionDocument,
} from "../../types/recurring-transaction";

vi.mock("@/features/recurring-transactions/commands/recurring-transactions", async () => {
  const byethrow = await import("@praha/byethrow");
  const actual = await vi.importActual(
    "@/features/recurring-transactions/commands/recurring-transactions",
  );
  return {
    ...(actual as object),
    previewRecurringAdoption: vi.fn(async () =>
      Promise.resolve(
        byethrow.Result.succeed({
          transactionId: "txn-1",
          firstScheduledLocal: "2026-04-21T10:00:00",
          laterDueCount: 2,
        }),
      ),
    ),
  };
});

afterEach(() => {
  cleanup();
});

function Harness({
  onSubmit,
}: {
  onSubmit: (
    values: AdoptRecurringFormValues,
  ) => Promise<Result.Result<RecurringAdoptOutcome, CommandError>>;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);

  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => setOpen(true)}>
        Make recurring
      </button>
      <Drawer open={open} onOpenChange={setOpen} swipeDirection="right">
        <RecurringAdoptDrawer
          open={open}
          onOpenChange={setOpen}
          onSubmit={onSubmit}
          categories={[]}
          returnFocusRef={buttonRef}
          transaction={{
            id: "txn-1",
            description: "Rent",
            amount: 120000,
            transactionDate: "2026-04-21T10:00:00",
            transactionType: "expense",
            transactionCategoryId: null,
            notes: null,
          }}
        />
      </Drawer>
    </>
  );
}

describe("RecurringAdoptDrawer", () => {
  it("previews later due count and returns focus after confirm", async () => {
    const onSubmit = vi.fn(async (_values: AdoptRecurringFormValues) => {
      return Result.succeed({
        outcome: "succeeded",
        document: {
          recurringTransaction: {
            id: "rt-1",
            lifecycle: "active",
            totalOccurrences: 6,
            fulfilledCount: 3,
            revision: 2,
            lifecycleChangedAt: "2026-07-21T10:00:00",
            createdAt: "2026-07-21T10:00:00",
            updatedAt: "2026-07-21T10:00:00",
          },
          schedule: {
            id: "sch-1",
            recurringTransactionId: "rt-1",
            sequence: 1,
            effectiveFromLocal: "2026-04-21T10:00:00",
            firstScheduledLocal: "2026-04-21T10:00:00",
            rule: { type: "interval", every: 1, unit: "month" },
          },
          template: {
            id: "tpl-1",
            recurringTransactionId: "rt-1",
            sequence: 1,
            effectiveFromLocal: "2026-04-21T10:00:00",
            amount: 120000,
            transactionType: "expense",
            description: "Rent",
          },
          occurrenceSummary: {
            fulfilledCount: 3,
            totalOccurrences: 6,
            nextScheduledLocal: "2026-07-21T10:00:00",
            needsAttention: false,
          },
          links: { state: "ready", occurrences: { items: [] } },
          failures: { state: "empty", waitingCount: 0, history: { items: [] } },
          budgetImpact: { state: "unavailable", message: "n/a" },
        } satisfies RecurringTransactionDocument,
      } satisfies RecurringAdoptOutcome);
    });

    render(<Harness onSubmit={onSubmit} />);

    await waitFor(() => {
      expect(screen.getByRole("status").textContent ?? "").toContain(
        "catch up 2 later due occurrences",
      );
    });

    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Monthly rent" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm adoption" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Make recurring" }));
    });
  });
});
