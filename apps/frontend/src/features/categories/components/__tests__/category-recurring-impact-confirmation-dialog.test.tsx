// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryRecurringImpactConfirmationDialog } from "../category-recurring-impact-confirmation-dialog";
import type { CategoryDeletionPreview, TransactionCategory } from "../../types/model";

const category: TransactionCategory = {
  id: "category-1",
  parentId: null,
  name: "Housing",
  description: null,
  color: null,
  role: "spending",
  parent: null,
};

const preview: CategoryDeletionPreview = {
  affectedRecurringTransactions: [
    { recurringTransactionId: "recurring-1", description: "Rent" },
    { recurringTransactionId: "recurring-2", description: "Home insurance" },
  ],
  affectedBudgets: [{ id: "budget-1", name: "Housing budget" }],
  blockedByCurrentBudget: false,
};

describe("CategoryRecurringImpactConfirmationDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("lists affected recurring transactions before deletion", () => {
    const onConfirm = vi.fn();

    render(
      <CategoryRecurringImpactConfirmationDialog
        category={category}
        preview={preview}
        open
        isConfirming={false}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Rent");
    expect(screen.getByRole("status").textContent).toContain("Home insurance");
    expect(screen.getByRole("status").textContent).toContain("Housing budget");

    fireEvent.click(screen.getByRole("button", { name: "Continue and delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("explains when a current budget blocks deletion", () => {
    render(
      <CategoryRecurringImpactConfirmationDialog
        category={category}
        preview={{
          ...preview,
          affectedRecurringTransactions: [],
          blockedByCurrentBudget: true,
        }}
        open
        isConfirming={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Housing budget");
    expect(screen.getByRole("status").textContent).toContain("Deletion blocked");
    expect(screen.queryByRole("button", { name: "Continue and delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeDefined();
  });
});
