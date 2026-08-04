// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { Drawer } from "@/components/ui/drawer";
import type { CommandError } from "@/commands/errors";

import { RecurringFormDrawer } from "../recurring-form-drawer";
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
      <Drawer open={open} onOpenChange={setOpen} swipeDirection="right">
        <RecurringFormDrawer
          mode={{ type: "create" }}
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

describe("RecurringFormDrawer", () => {
  it("uses the transaction entry controls for recurring template fields", () => {
    const onSubmit =
      vi.fn<
        (
          values: RecurringFormValues,
        ) => Promise<Result.Result<RecurringCreateOutcome, CommandError>>
      >();

    render(<Harness onSubmit={onSubmit} />);

    expect(screen.getByText("Record a recurring income or expense")).toBeDefined();

    const typeGroup = screen.getByRole("group", { name: "Transaction type" });
    const expense = within(typeGroup).getByRole("button", { name: "expense" });
    const income = within(typeGroup).getByRole("button", { name: "income" });

    expect(expense.querySelector("svg[data-icon='inline-start']")).not.toBeNull();
    expect(income.querySelector("svg[data-icon='inline-start']")).not.toBeNull();
    expect(expense.querySelector("svg")?.classList.contains("text-destructive")).toBe(true);
    expect(income.querySelector("svg")?.classList.contains("text-primary")).toBe(true);

    const amount = screen.getByLabelText("Amount");
    expect(amount.getAttribute("placeholder")).toBe("0.00");
    expect(screen.getByText("EUR")).toBeDefined();

    expect(screen.getByRole("combobox", { name: "Choose category" })).toBeDefined();
    expect(screen.getByLabelText("Description").getAttribute("placeholder")).toBe(
      "Coffee, salary, rent...",
    );

    const notes = screen.getByLabelText("Notes");
    expect(notes.tagName).toBe("TEXTAREA");
    expect(notes.getAttribute("placeholder")).toBe("Optional details for your own reference");
  });

  it("places first occurrence after amount with separate date and time controls", () => {
    const onSubmit =
      vi.fn<
        (
          values: RecurringFormValues,
        ) => Promise<Result.Result<RecurringCreateOutcome, CommandError>>
      >();

    render(<Harness onSubmit={onSubmit} />);

    const amountField = screen.getByLabelText("Amount").closest('[data-slot="field"]');
    const firstOccurrenceField = screen
      .getByText("First occurrence")
      .closest('[data-slot="field"]');
    const categoryField = screen.getByText("Category").closest('[data-slot="field"]');
    const descriptionField = screen.getByText("Description").closest('[data-slot="field"]');

    expect(amountField).not.toBeNull();
    expect(firstOccurrenceField).not.toBeNull();
    expect(categoryField).not.toBeNull();
    expect(descriptionField).not.toBeNull();
    expect(amountField?.nextElementSibling).toBe(firstOccurrenceField);
    expect(categoryField?.nextElementSibling).toBe(descriptionField);
    expect(firstOccurrenceField?.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(firstOccurrenceField?.querySelector("button")).not.toBeNull();
    expect(firstOccurrenceField?.querySelector('input[type="time"]')).not.toBeNull();
  });

  it("submits a valid create and returns focus to the trigger", async () => {
    const onSubmit = vi.fn(async (values: RecurringFormValues) => {
      expect(values.description).toBe("Gym");
      expect(values.amount).toBe(4500);
      return Result.succeed({
        outcome: "succeeded",
        document: {
          recurringTransaction: {
            id: "rt-1",
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
            description: values.description,
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
            waitingCount: 0,
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

    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Gym" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "45.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create recurring transaction" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "New recurring" }));
    });
  });

  it("opens in edit mode and preserves edits through submit rerenders", async () => {
    const document = {
      recurringTransaction: {
        id: "rt-1",
        lifecycle: "active",
        totalOccurrences: 12,
        fulfilledCount: 2,
        revision: 3,
        lifecycleChangedAt: "2026-07-21T10:00:00",
        createdAt: "2026-07-21T10:00:00",
        updatedAt: "2026-07-21T10:00:00",
      },
      schedule: {
        id: "sch-1",
        recurringTransactionId: "rt-1",
        sequence: 1,
        effectiveFromLocal: "2026-01-01T09:00:00",
        firstScheduledLocal: "2026-01-01T09:00:00",
        rule: { type: "interval" as const, every: 1, unit: "month" as const },
      },
      template: {
        id: "tpl-1",
        recurringTransactionId: "rt-1",
        sequence: 1,
        effectiveFromLocal: "2026-01-01T09:00:00",
        amount: 120_000,
        transactionType: "expense" as const,
        description: "Monthly rent",
      },
      occurrenceSummary: {
        fulfilledCount: 2,
        totalOccurrences: 12,
        needsAttention: false,
        nextScheduledLocal: "2026-03-01T09:00:00",
      },
      links: {
        state: "ready" as const,
        occurrences: { items: [] },
      },
      failures: {
        state: "ready" as const,
        waitingCount: 0,
        history: { items: [] },
      },
      budgetImpact: {
        state: "unavailable" as const,
        message: "Budget impact is not available yet",
      },
    } satisfies RecurringTransactionDocument;

    const onSubmit = vi.fn(async (values: RecurringFormValues) => {
      expect(values.amount).toBe(125_000);
      return Result.succeed({ outcome: "succeeded", document });
    });

    render(
      <Drawer open swipeDirection="right">
        <RecurringFormDrawer
          mode={{ type: "edit", document }}
          open
          onOpenChange={() => undefined}
          onSubmit={onSubmit}
          categories={[]}
        />
      </Drawer>,
    );

    expect(screen.getByRole("heading", { name: "Edit recurring transaction" })).toBeTruthy();
    expect(screen.getByLabelText("Description")).toHaveProperty("value", "Monthly rent");
    expect(screen.getByLabelText("Next occurrence")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1250.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
