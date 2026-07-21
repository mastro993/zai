// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { Drawer } from "@/components/ui/drawer";
import type { CommandError } from "@/commands/errors";

import { RecurringCreateDrawer } from "../recurring-create-drawer";
import type {
  RecurringCreateOutcome,
  RecurringFormValues,
  RecurringTransactionDocument,
} from "../../types/recurring-transaction";

afterEach(() => {
  cleanup();
});

function Harness({
  onSubmit,
}: {
  onSubmit: (
    values: RecurringFormValues,
  ) => Promise<Result.Result<RecurringCreateOutcome, CommandError>>;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);

  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => setOpen(true)}>
        New recurring
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <RecurringCreateDrawer
          open={open}
          onOpenChange={setOpen}
          onSubmit={onSubmit}
          categories={[]}
          returnFocusRef={buttonRef}
        />
      </Drawer>
    </>
  );
}

describe("RecurringCreateDrawer", () => {
  it("submits a valid create and returns focus to the trigger", async () => {
    const onSubmit = vi.fn(async (values: RecurringFormValues) => {
      expect(values.name).toBe("Gym");
      expect(values.amount).toBe(4500);
      return Result.succeed({
        outcome: "succeeded",
        document: {
          recurringTransaction: {
            id: "rt-1",
            name: values.name,
            lifecycle: "active",
            totalOccurrences: null,
            fulfilledCount: 0,
            revision: 1,
            lifecycleChangedAt: "2026-07-21T10:00:00",
            createdAt: "2026-07-21T10:00:00",
            updatedAt: "2026-07-21T10:00:00",
          },
          schedule: {
            id: "sch-1",
            recurringTransactionId: "rt-1",
            sequence: 1,
            effectiveFromLocal: "2026-07-21T10:00:00",
            firstScheduledLocal: values.firstScheduledLocal,
            rule: { type: "interval", every: 1, unit: "month" },
          },
          template: {
            id: "tpl-1",
            recurringTransactionId: "rt-1",
            sequence: 1,
            effectiveFromLocal: "2026-07-21T10:00:00",
            amount: values.amount,
            transactionType: values.transactionType,
          },
          occurrenceSummary: {
            fulfilledCount: 0,
            totalOccurrences: null,
            needsAttention: false,
          },
          links: {
            state: "ready",
            occurrences: { items: [] },
          },
          failures: {
            state: "ready",
            history: { items: [] },
          },
          budgetImpact: {
            state: "unavailable",
            message: "Budget impact is not available yet",
          },
        } satisfies RecurringTransactionDocument,
      } satisfies RecurringCreateOutcome);
    });

    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Gym" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "45.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create recurring transaction" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "New recurring" }));
    });
  });
});
