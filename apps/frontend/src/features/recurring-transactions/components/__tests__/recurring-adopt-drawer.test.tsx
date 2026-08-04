// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { Drawer } from "@/components/ui/drawer";
import type { CommandError } from "@/commands/errors";
import { formatCurrencyFromMinor } from "@/lib/currency";

import { RecurringAdoptDrawer } from "../recurring-adopt-drawer";
import { formatLocalDateTime } from "../../lib/recurring";
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

    expect(screen.getByRole("heading", { name: "Transaction snapshot" })).toBeDefined();
    expect(screen.getByText("Rent")).toBeDefined();
    expect(screen.getByText(formatCurrencyFromMinor(120000, "EUR"))).toBeDefined();
    expect(screen.getByText("Expense")).toBeDefined();
    expect(screen.getByText("Original date")).toBeDefined();
    expect(screen.getByText(formatLocalDateTime("2026-04-21T10:00:00"))).toBeDefined();
    expect(screen.getByText("Uncategorized")).toBeDefined();
    const scheduleCombobox = screen.getByRole("combobox", { name: "Schedule" });
    const totalOccurrencesCombobox = screen.getByRole("combobox", {
      name: "Total occurrences",
    });
    expect(scheduleCombobox.textContent).toContain("Interval");
    expect(totalOccurrencesCombobox.textContent).toContain("Indefinite");

    fireEvent.click(scheduleCombobox);
    expect(screen.getByText("Repeat after a set interval.")).toBeDefined();
    expect(screen.getByText("Repeat on the same day each month.")).toBeDefined();

    fireEvent.click(totalOccurrencesCombobox);
    expect(screen.getByText("Continue until you stop the recurring transaction.")).toBeDefined();
    expect(screen.getByText("Stop after a set number of occurrences.")).toBeDefined();

    const intervalGroup = screen.getByRole("group", { name: "Interval schedule" });
    const intervalInput = screen.getByLabelText("Every");
    const intervalSelect = screen.getByRole("combobox", { name: "Interval unit" });
    expect(intervalGroup.contains(intervalInput)).toBe(true);
    expect(intervalGroup.contains(intervalSelect)).toBe(true);
    expect(intervalSelect.textContent).toContain("month");
    expect((intervalInput as HTMLInputElement).value).toBe("1");

    fireEvent.change(intervalInput, { target: { value: "2" } });
    await waitFor(() => {
      expect(intervalSelect.textContent).toContain("months");
    });
    fireEvent.change(intervalInput, { target: { value: "1" } });
    await waitFor(() => {
      expect(intervalSelect.textContent).toContain("month");
    });
    expect(screen.queryByRole("textbox", { name: "Description" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Future amount" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expense" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Transaction category" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Notes" })).toBeNull();
    const drawerFooter = document.querySelector('[data-slot="drawer-footer"]');
    expect(drawerFooter).not.toBeNull();
    expect(drawerFooter?.classList.contains("p-0")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Confirm adoption" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(onSubmit).toHaveBeenCalledWith({
        scheduleKind: "interval",
        intervalEvery: "1",
        intervalUnit: "month",
        monthlyDay: "1",
        totalMode: "indefinite",
        totalOccurrences: "",
      });
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Make recurring" }));
    });
  });
});
