// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TransactionCategory } from "@/features/categories/types/model";

import { BudgetCategoryCombobox } from "../budget-category-combobox";

const food = {
  id: "food",
  parentId: null,
  name: "Food",
  role: "spending",
  color: "#C32828",
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

const income = {
  id: "income",
  parentId: null,
  name: "Income",
  role: "income",
  color: "#28C34E",
} as TransactionCategory;

const renderSelector = (
  overrides: Partial<React.ComponentProps<typeof BudgetCategoryCombobox>> = {},
) =>
  render(
    <BudgetCategoryCombobox
      id="budget-categories-trigger"
      categories={[food, groceries, restaurants]}
      value={[]}
      parentOpen
      onChange={vi.fn()}
      {...overrides}
    />,
  );

describe("BudgetCategoryCombobox", () => {
  afterEach(() => cleanup());

  it("renders parents and children as flat, scoped options", () => {
    renderSelector();

    fireEvent.click(screen.getByRole("combobox", { name: /Choose categories/ }));

    expect(screen.getByRole("dialog", { name: "Select categories" })).toBeTruthy();
    expect(screen.getByLabelText("Search categories")).toBeTruthy();
    expect(screen.getAllByRole("option").map((option) => option.textContent?.trim())).toEqual([
      "Food",
      "Food / Groceries",
      "Food / Restaurants",
    ]);
  });

  it("filters by a child name while retaining its parent context", () => {
    renderSelector({ categories: [food, groceries, income] });

    fireEvent.click(screen.getByRole("combobox", { name: /Choose categories/ }));
    fireEvent.change(screen.getByLabelText("Search categories"), {
      target: { value: "groceries" },
    });

    expect(screen.getByRole("option", { name: "Food" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Food / Groceries" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Income" })).toBeNull();
  });

  it("commits canonical root and child selections through the public callback", () => {
    const onChange = vi.fn();
    const result = renderSelector({ categories: [food, groceries], onChange });

    fireEvent.click(screen.getByRole("combobox", { name: /Choose categories/ }));
    fireEvent.click(screen.getByRole("option", { name: "Food" }));

    expect(onChange).toHaveBeenCalledWith(["food"]);
    result.rerender(
      <BudgetCategoryCombobox
        id="budget-categories-trigger"
        categories={[food, groceries]}
        value={["food"]}
        parentOpen
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("option", { name: "Food" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("shows the all-categories placeholder and empty-state copy", () => {
    renderSelector({ categories: [] });

    expect(screen.getByText("All categories")).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: /Choose categories/ }));
    expect(
      screen.getByText(/No categories yet\. This budget will include all transactions\./),
    ).toBeTruthy();
  });
});
