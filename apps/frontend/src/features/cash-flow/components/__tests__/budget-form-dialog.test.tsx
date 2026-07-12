// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Result } from "@praha/byethrow";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";

import { BudgetFormDialog } from "../budget-form-dialog";
import type { Budget } from "../../types/budget";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

describe("BudgetFormDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits the default warning percentage", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(Result.succeed({} as Budget));

    render(
      <BudgetFormDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} categories={[]} />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Monthly spending" } });
    fireEvent.change(screen.getByLabelText("Monthly allowance"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ warningPercentage: 80 }));
    });
  });

  it("submits custom and disabled warning percentages", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(Result.succeed({} as Budget));

    render(
      <BudgetFormDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} categories={[]} />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Monthly spending" } });
    fireEvent.change(screen.getByLabelText("Monthly allowance"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Warning threshold (%)"), { target: { value: "65" } });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenNthCalledWith(1, expect.objectContaining({ warningPercentage: 65 }));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Monthly spending" } });
    fireEvent.change(screen.getByLabelText("Monthly allowance"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Disable budget warning/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ warningPercentage: null }),
    );
  });

  it("shows duplicate-name failures on the name field", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(
      Result.fail(
        new CommandError("An active budget with this name already exists", {
          code: "nameConflict",
        }),
      ),
    );

    render(
      <BudgetFormDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} categories={[]} />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Monthly spending" } });
    fireEvent.change(screen.getByLabelText("Monthly allowance"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "An active budget with this name already exists",
      );
    });
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("loads edit values and keeps cadence read-only", () => {
    const budget = {
      id: "budget-1",
      name: "Weekly groceries",
      revision: 3,
      categoryIds: ["groceries"],
      cadence: "week",
      measurementMode: "spending",
      baseAllowance: 12500,
      rolloverMode: "off",
      warningPercentage: 65,
      currentPeriod: {
        start: "2026-07-06T00:00:00",
        end: "2026-07-13T00:00:00",
        baseAllowance: 12500,
        effectiveAllowance: 12500,
        netBudgetSpending: 2500,
        remainingAllowance: 10000,
        status: "onTrack",
      },
    } as Budget;

    render(
      <BudgetFormDialog
        open
        mode="edit"
        budget={budget}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(Result.succeed(budget))}
        categories={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Edit budget" })).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Weekly groceries");
    expect((screen.getByLabelText("Monthly allowance") as HTMLInputElement).value).toBe("125.00");
    expect(screen.getByLabelText("Budget cadence").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Save budget" })).toBeTruthy();
  });
});
