// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BudgetDeleteConfirmationDialog } from "../budget-delete-confirmation-dialog";
import type { Budget } from "../../types/budget";

const budget = {
  id: "budget-1",
  name: "Monthly spending",
  revision: 2,
  paused: false,
  categoryIds: [],
  cadence: "month",
  measurementMode: "spending",
  baseAllowance: 10_000,
  rolloverMode: "off",
  warningPercentage: 80,
  currentPeriod: {
    start: "2026-07-01T00:00:00",
    end: "2026-08-01T00:00:00",
    baseAllowance: 10_000,
    effectiveAllowance: 10_000,
    netBudgetSpending: 0,
    remainingAllowance: 10_000,
    status: "onTrack",
  },
} as Budget;

describe("BudgetDeleteConfirmationDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("requires explicit confirmation and explains retained data", () => {
    const onDelete = vi.fn();

    render(
      <BudgetDeleteConfirmationDialog
        budget={budget}
        open
        isDeleting={false}
        onOpenChange={vi.fn()}
        onOpenChangeComplete={vi.fn()}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText(/history remain retained and cannot be restored/)).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete budget" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
