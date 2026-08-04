// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { Drawer } from "@/components/ui/drawer";
import { CommandError } from "@/commands/errors";

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

function chooseOption(triggerName: string, optionName: string) {
  fireEvent.click(screen.getByRole("combobox", { name: triggerName }));
  const option = screen.getByRole("option", { name: optionName });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
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

  it("renders one occurrence input with an indefinite placeholder", () => {
    const onSubmit =
      vi.fn<
        (
          values: RecurringFormValues,
        ) => Promise<Result.Result<RecurringCreateOutcome, CommandError>>
      >();

    render(<Harness onSubmit={onSubmit} />);

    const occurrences = screen.getByLabelText("Occurrencies");
    expect(occurrences).toHaveProperty("type", "number");
    expect(occurrences).toHaveProperty("value", "");
    expect(occurrences.getAttribute("placeholder")).toBe("Until stopped");
    expect(occurrences.getAttribute("aria-describedby")).toBe("recurring-total-description");
    expect(
      screen
        .getByText(
          "Enter a number to stop after that many occurrences. Leave blank to continue until you stop the recurring transaction.",
        )
        .getAttribute("id"),
    ).toBe("recurring-total-description");
    expect(screen.queryByText("Total")).toBeNull();
    expect(screen.queryByText("Indefinite")).toBeNull();
    expect(screen.queryByText("Finite")).toBeNull();
  });

  it("renders the default schedule as one joined Every input group", () => {
    const onSubmit =
      vi.fn<
        (
          values: RecurringFormValues,
        ) => Promise<Result.Result<RecurringCreateOutcome, CommandError>>
      >();

    render(<Harness onSubmit={onSubmit} />);

    const scheduleGroup = screen.getByRole("group", { name: "Schedule" });
    expect(scheduleGroup).toBeDefined();
    expect(
      within(scheduleGroup).getByRole("combobox", { name: "Schedule mode" }).textContent,
    ).toContain("Every");
    const interval = within(scheduleGroup).getByRole("spinbutton", { name: "Interval value" });
    expect(interval).toHaveProperty("value", "1");
    expect(interval).toHaveProperty("type", "number");
    expect(interval.getAttribute("min")).toBe("1");
    expect(interval.getAttribute("step")).toBe("1");
    expect(
      within(scheduleGroup).getByRole("combobox", { name: "Interval unit" }).textContent,
    ).toContain("month");
    expect(screen.queryByText("of the month")).toBeNull();
  });

  it("preserves interval and monthly day values while switching schedule modes", () => {
    const onSubmit =
      vi.fn<
        (
          values: RecurringFormValues,
        ) => Promise<Result.Result<RecurringCreateOutcome, CommandError>>
      >();

    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Interval value" }), {
      target: { value: "2" },
    });
    expect(screen.getByRole("combobox", { name: "Interval unit" }).textContent).toContain("months");
    chooseOption("Interval unit", "weeks");
    expect(screen.getByRole("combobox", { name: "Interval unit" }).textContent).toContain("weeks");

    chooseOption("Schedule mode", "On");

    expect(screen.getByText("of the month")).toBeDefined();
    const monthlyDay = screen.getByRole("combobox", { name: "Monthly day" });
    expect(monthlyDay.textContent).toContain("1st");
    expect(monthlyDay.classList.contains("w-full")).toBe(true);
    chooseOption("Monthly day", "31st");

    chooseOption("Schedule mode", "Every");

    expect(screen.getByRole("spinbutton", { name: "Interval value" })).toHaveProperty("value", "2");
    expect(screen.getByRole("combobox", { name: "Interval unit" }).textContent).toContain("weeks");

    chooseOption("Schedule mode", "On");
    expect(screen.getByRole("combobox", { name: "Monthly day" }).textContent).toContain("31st");
  });

  it("submits the selected monthly day schedule values", async () => {
    const onSubmit = vi.fn(async (values: RecurringFormValues) => {
      expect(values.scheduleKind).toBe("monthlyDay");
      expect(values.monthlyDay).toBe("31");
      return Result.fail(new CommandError("test submission"));
    });

    render(<Harness onSubmit={onSubmit} />);

    chooseOption("Schedule mode", "On");
    chooseOption("Monthly day", "31st");
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Rent" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1200.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create recurring transaction" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("places first occurrence after notes and before schedule", () => {
    const onSubmit =
      vi.fn<
        (
          values: RecurringFormValues,
        ) => Promise<Result.Result<RecurringCreateOutcome, CommandError>>
      >();

    render(<Harness onSubmit={onSubmit} />);

    const firstOccurrenceField = screen
      .getByText("First occurrence")
      .closest('[data-slot="field"]');
    const categoryField = screen.getByText("Category").closest('[data-slot="field"]');
    const descriptionField = screen.getByText("Description").closest('[data-slot="field"]');
    const notesField = screen.getByText("Notes").closest('[data-slot="field"]');
    const scheduleField = screen.getByText("Schedule").closest('[data-slot="field"]');

    expect(firstOccurrenceField).not.toBeNull();
    expect(categoryField).not.toBeNull();
    expect(descriptionField).not.toBeNull();
    expect(notesField).not.toBeNull();
    expect(scheduleField).not.toBeNull();
    expect(categoryField?.nextElementSibling).toBe(descriptionField);
    expect(notesField?.nextElementSibling).toBe(firstOccurrenceField);
    expect(firstOccurrenceField?.nextElementSibling).toBe(scheduleField);
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
