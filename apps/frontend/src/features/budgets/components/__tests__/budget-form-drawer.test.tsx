// @vitest-environment jsdom

import { Result } from "@praha/byethrow";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "@/components/ui/drawer";
import { CommandError } from "@/commands/errors";
import { categorySchema, type TransactionCategory } from "@/features/categories/types/model";

import { budgetMeasurementDescription, budgetRolloverDescription } from "../../lib/budget";
import { budgetSchema, type Budget, type BudgetFormValues } from "../../types/budget";
import { BudgetFormDrawer } from "../budget-form-drawer";

type BudgetSubmit = (values: BudgetFormValues) => Promise<Result.Result<Budget, CommandError>>;

const sampleBudget = budgetSchema.parse({
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
});

const createSubmitMock = () =>
  vi.fn<BudgetSubmit>().mockResolvedValue(Result.succeed(sampleBudget));

interface RenderBudgetFormOptions {
  onOpenChange?: (open: boolean) => void;
  onSubmit?: BudgetSubmit;
  categories?: Array<TransactionCategory>;
  budget?: Budget;
  mode?: "create" | "edit";
}

const renderBudgetForm = ({
  onOpenChange = vi.fn(),
  onSubmit = createSubmitMock(),
  categories = [],
  budget,
  mode = "create",
}: RenderBudgetFormOptions = {}) =>
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

  it("opens measurement and rollover comboboxes with explanations", () => {
    renderBudgetForm();

    const measurementTrigger = screen.getByRole("combobox", { name: "Budget measurement" });
    expect(
      screen.getByText("Choose whether the budget tracks spending or net cash flow."),
    ).toBeTruthy();
    expect(measurementTrigger.getAttribute("aria-describedby")).toBe(
      "budget-measurement-description",
    );

    fireEvent.click(measurementTrigger);
    expect(screen.getByRole("dialog", { name: "Select budget measurement" })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Spending/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Net cash flow/ })).toBeTruthy();
    expect(screen.getByText(budgetMeasurementDescription.spending)).toBeTruthy();
    expect(screen.getByText(budgetMeasurementDescription.netCashFlow)).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: /Spending/ }));
    const rolloverTrigger = screen.getByRole("combobox", { name: "Budget rollover" });
    expect(
      screen.getByText("Choose how leftover allowance or overspend carries into future periods."),
    ).toBeTruthy();
    expect(rolloverTrigger.getAttribute("aria-describedby")).toBe("budget-rollover-description");

    fireEvent.click(rolloverTrigger);
    expect(screen.getByRole("dialog", { name: "Select budget rollover" })).toBeTruthy();
    expect(screen.getByRole("option", { name: /No rollover/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Previous period only/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Cumulative/ })).toBeTruthy();
    expect(screen.getByText(budgetRolloverDescription.off)).toBeTruthy();
    expect(screen.getByText(budgetRolloverDescription.cumulative)).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: /Cumulative/ }));
    expect(rolloverTrigger.textContent).toContain("Cumulative");
  });

  it("updates measurement from the combobox", () => {
    renderBudgetForm();

    const trigger = screen.getByRole("combobox", { name: "Budget measurement" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: /Net cash flow/ }));

    expect(trigger.textContent).toContain("Net cash flow");
  });

  it("keeps the budget form copy focused and opens cadence options with icons", () => {
    renderBudgetForm();

    expect(screen.queryByText("Must be unique among your budgets.")).toBeNull();
    expect(screen.getByText("Roots include their subcategories.")).toBeTruthy();
    expect(
      screen.queryByText("Empty includes all transactions. Roots include their subcategories."),
    ).toBeNull();

    const cadence = screen.getByRole("combobox", { name: "Budget cadence" });
    expect(cadence.getAttribute("aria-describedby")).toBe("budget-cadence-description");

    fireEvent.click(cadence);

    const cadenceDialog = screen.getByRole("dialog", { name: "Select budget cadence" });
    const cadenceOptions = within(cadenceDialog).getAllByRole("option");
    expect(cadenceOptions).toHaveLength(4);
    expect(
      cadenceOptions.every((option) => option.querySelector("[data-slot='budget-rule-icon'] svg")),
    ).toBe(true);
    expect(screen.getByText("One period for each calendar day.")).toBeTruthy();
    expect(screen.getByText("One period from Monday to Sunday.")).toBeTruthy();
    expect(screen.getByText("One period for each calendar month.")).toBeTruthy();
    expect(screen.getByText("One period for each calendar year.")).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: /Year/ }));
    expect(cadence.textContent).toContain("Year");
  });

  it("filters and canonicalizes category selections", async () => {
    const food = categorySchema.parse({
      id: "food",
      parentId: null,
      name: "Food",
      role: "spending",
      color: "#C32828",
    });
    const categories = [
      food,
      categorySchema.parse({
        id: "rent",
        parentId: "food",
        name: "Rent",
        role: "spending",
        parent: food,
        color: "#C32828",
      }),
      categorySchema.parse({
        id: "income",
        parentId: null,
        name: "Income",
        role: "income",
        color: "#28C34E",
      }),
    ];
    const onSubmit = createSubmitMock();
    renderBudgetForm({ categories, onSubmit });

    fireEvent.click(screen.getByRole("combobox", { name: /Choose categories/ }));
    fireEvent.change(screen.getByLabelText("Search categories"), { target: { value: "rent" } });

    expect(screen.getByRole("option", { name: "Food" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Food / Rent" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Income" })).toBeNull();

    fireEvent.click(screen.getByRole("option", { name: "Food / Rent" }));
    fireEvent.click(screen.getByRole("combobox", { name: /Choose categories/ }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Rent budget" } });
    fireEvent.change(screen.getByLabelText("Allowance"), { target: { value: "800" } });
    fireEvent.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: ["food"] })),
    );
  });

  it("selects descendants with a root and keeps the saved scope canonical", async () => {
    const food = categorySchema.parse({
      id: "food",
      parentId: null,
      name: "Food",
      color: "#26C55B",
      role: "spending",
    });
    const groceries = categorySchema.parse({
      id: "groceries",
      parentId: "food",
      name: "Groceries",
      role: "spending",
      parent: food,
      color: "#26C55B",
    });
    const restaurants = categorySchema.parse({
      id: "restaurants",
      parentId: "food",
      name: "Restaurants",
      role: "spending",
      parent: food,
      color: "#26C55B",
    });
    const onSubmit = createSubmitMock();
    renderBudgetForm({ categories: [food, groceries, restaurants], onSubmit });

    fireEvent.click(screen.getByRole("combobox", { name: /Choose categories/ }));
    fireEvent.click(screen.getByRole("option", { name: "Food" }));

    expect(screen.getByRole("option", { name: "Food" }).getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getByRole("option", { name: "Food / Groceries" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("option", { name: "Food / Restaurants" }).getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("option", { name: "Food / Groceries" }));
    expect(screen.getByRole("option", { name: "Food, partially selected" })).toBeTruthy();

    let trigger = screen.getByRole("combobox", { name: /Choose categories/ });
    expect(within(trigger).queryByText("Food")).toBeNull();
    expect(within(trigger).getByText("Food / Restaurants")).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: "Food / Groceries" }));
    fireEvent.click(trigger);

    trigger = screen.getByRole("combobox", { name: /Choose categories/ });
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
    renderBudgetForm({ budget: sampleBudget, mode: "edit" });

    expect(screen.getByRole("heading", { name: "Edit budget" })).toBeTruthy();
    const name = screen.getByLabelText("Name");
    expect(name).toBeInstanceOf(HTMLInputElement);
    if (!(name instanceof HTMLInputElement)) return;
    expect(name.value).toBe("Weekly groceries");
    const allowance = screen.getByLabelText("Allowance");
    expect(allowance).toBeInstanceOf(HTMLInputElement);
    if (!(allowance instanceof HTMLInputElement)) return;
    expect(allowance.value).toBe("125.00");
    const cadence = screen.getByRole("combobox", { name: "Budget cadence" });
    expect(cadence).toBeInstanceOf(HTMLButtonElement);
    if (!(cadence instanceof HTMLButtonElement)) return;
    expect(cadence.disabled).toBe(true);
    expect(cadence.textContent).toContain("Week");
    expect(screen.getByRole("button", { name: "Save budget" })).toBeTruthy();
  });
});
