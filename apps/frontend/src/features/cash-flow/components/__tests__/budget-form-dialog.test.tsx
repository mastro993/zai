// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Result } from "@praha/byethrow";
import { describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";

import { BudgetFormDialog } from "../budget-form-dialog";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

describe("BudgetFormDialog", () => {
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
});
