// @vitest-environment jsdom

import { Result } from "@praha/byethrow";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "@/components/ui/drawer";
import { CommandError } from "@/commands/errors";

import type { Budget } from "../../types/budget";
import type { TransactionCategory } from "../../types/model";
import { budgetMeasurementDescription, budgetRolloverDescription } from "../../lib/budget";
import { BudgetFormDrawer } from "../budget-form-drawer";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

type BudgetFormDrawerProps = ComponentProps<typeof BudgetFormDrawer>;

const createSubmitMock = () =>
  vi.fn<BudgetFormDrawerProps["onSubmit"]>().mockResolvedValue(Result.succeed({} as Budget));

const renderBudgetForm = ({
  onOpenChange = vi.fn(),
  onSubmit = createSubmitMock(),
  categories = [],
  budget,
  mode = "create",
}: {
  onOpenChange?: (open: boolean) => void;
  onSubmit?: BudgetFormDrawerProps["onSubmit"];
  categories?: Array<TransactionCategory>;
  budget?: Budget;
  mode?: "create" | "edit";
} = {}) =>
  render(
    <Drawer open swipeDirection="right">
      <BudgetFormDrawer
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        categories={categories}
        budget={budget}
        mode={mode}
      />
    </Drawer>,
  );

describe("BudgetFormDrawer", () => {
  afterEach(() => cleanup());

  it("submits the default warning percentage", async () => {
    const onSubmit = createSubmitMock();
    renderBudgetForm({ onSubmit });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Monthly spending" } });
    fireEvent.change(screen.getByLabelText("Allowance"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ warningPercentage: 80 })),
    );
  });

  it("submits custom and disabled warning percentages", async () => {
    const onSubmit = createSubmitMock();
    renderBudgetForm({ onSubmit });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Monthly spending" } });
    fireEvent.change(screen.getByLabelText("Allowance"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Warning percentage"), { target: { value: "65" } });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenNthCalledWith(1, expect.objectContaining({ warningPercentage: 65 }));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Monthly spending" } });
    fireEvent.change(screen.getByLabelText("Allowance"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Warn at" }));
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ warningPercentage: null }),
    );
  });

  it("shows measurement and rollover selects with selected explanations", () => {
    renderBudgetForm();

    expect(screen.getByText(budgetMeasurementDescription.spending)).toBeTruthy();
    expect(screen.getByText(budgetRolloverDescription.off)).toBeTruthy();
    expect(budgetMeasurementDescription.netCashFlow).toContain("matching income");
    expect(budgetRolloverDescription.cumulative).toContain("accumulate");

    fireEvent.click(screen.getByLabelText("Budget measurement"));
    expect(screen.getByRole("option", { name: "Spending" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Net cash flow" })).toBeTruthy();
  });

  it("lists rollover options in a select", () => {
    renderBudgetForm();

    fireEvent.click(screen.getByLabelText("Budget rollover"));
    expect(screen.getByRole("option", { name: "No rollover" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Previous period only" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Cumulative" })).toBeTruthy();
  });

  it("filters and canonicalizes category selections", async () => {
    const food = {
      id: "food",
      parentId: null,
      name: "Food",
      role: "spending",
    } as TransactionCategory;
    const categories = [
      food,
      {
        id: "rent",
        parentId: "food",
        name: "Rent",
        role: "spending",
        parent: food,
      } as TransactionCategory,
      {
        id: "income",
        parentId: null,
        name: "Income",
        role: "income",
      } as TransactionCategory,
    ];
    const onSubmit = createSubmitMock();
    renderBudgetForm({ categories, onSubmit });

    fireEvent.click(screen.getByRole("button", { name: /Choose categories/ }));
    fireEvent.change(screen.getByLabelText("Search categories"), { target: { value: "rent" } });

    expect(screen.getByRole("checkbox", { name: "Food" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Rent" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Income" })).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "Rent" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Rent budget" } });
    fireEvent.change(screen.getByLabelText("Allowance"), { target: { value: "800" } });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: ["food"] })),
    );
  });

  it("selects descendants with a root and keeps the saved scope canonical", async () => {
    const food = {
      id: "food",
      parentId: null,
      name: "Food",
      color: "#147B1E",
      role: "spending",
    } as TransactionCategory;
    const groceries = {
      id: "groceries",
      parentId: "food",
      name: "Groceries",
      role: "spending",
      parent: food,
    } as TransactionCategory;
    const restaurants = {
      id: "restaurants",
      parentId: "food",
      name: "Restaurants",
      role: "spending",
      parent: food,
    } as TransactionCategory;
    const onSubmit = createSubmitMock();
    renderBudgetForm({ categories: [food, groceries, restaurants], onSubmit });

    fireEvent.click(screen.getByRole("button", { name: /Choose categories/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Food" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Food" }));

    expect(screen.getByRole("checkbox", { name: "Groceries" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Restaurants" }).getAttribute("aria-checked")).toBe(
      "true",
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Groceries" }));
    expect(screen.getByRole("checkbox", { name: "Food" }).getAttribute("aria-checked")).toBe(
      "mixed",
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    let trigger = screen.getByRole("button", { name: /Choose categories/ });
    expect(within(trigger).queryByText("Food")).toBeNull();
    expect(within(trigger).getByText("Food / Restaurants")).toBeTruthy();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("checkbox", { name: "Groceries" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    trigger = screen.getByRole("button", { name: /Choose categories/ });
    expect(within(trigger).getByText("Food")).toBeTruthy();
    expect(within(trigger).queryByText("Food / Groceries")).toBeNull();
    expect(within(trigger).queryByText("Food / Restaurants")).toBeNull();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food budget" } });
    fireEvent.change(screen.getByLabelText("Allowance"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: ["food"] })),
    );
  });

  it("shows duplicate-name failures on the name field", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = createSubmitMock();
    onSubmit.mockResolvedValue(
      Result.fail(
        new CommandError("An active budget with this name already exists", {
          code: "nameConflict",
        }),
      ),
    );
    renderBudgetForm({ onOpenChange, onSubmit });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Monthly spending" } });
    fireEvent.change(screen.getByLabelText("Allowance"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "An active budget with this name already exists",
      ),
    );
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("loads edit values and keeps cadence read-only", () => {
    const budget = {
      id: "budget-1",
      name: "Weekly groceries",
      revision: 3,
      paused: false,
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
    renderBudgetForm({ budget, mode: "edit" });

    expect(screen.getByRole("heading", { name: "Edit budget" })).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Weekly groceries");
    expect((screen.getByLabelText("Allowance") as HTMLInputElement).value).toBe("125.00");
    const cadence = screen.getByLabelText("Budget cadence");
    expect(
      within(cadence)
        .getAllByRole("button")
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Save budget" })).toBeTruthy();
  });
});
