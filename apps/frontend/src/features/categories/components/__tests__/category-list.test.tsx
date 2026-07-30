// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TransactionCategory } from "../../types/model";
import { CategoryList } from "../category-list";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

const food = {
  id: "food",
  parentId: null,
  name: "Food",
  description: null,
  color: "#C32828",
  role: "spending",
  parent: null,
} as TransactionCategory;

const groceries = {
  id: "groceries",
  parentId: "food",
  name: "Groceries",
  description: null,
  color: null,
  role: "spending",
  parent: food,
} as TransactionCategory;

const salary = {
  id: "salary",
  parentId: null,
  name: "Salary",
  description: null,
  color: "#28C34E",
  role: "income",
  parent: null,
} as TransactionCategory;

describe("CategoryList", () => {
  afterEach(() => cleanup());

  it("splits categories by role and keeps child rows expandable", () => {
    render(
      <CategoryList
        categories={[food, groceries, salary]}
        onAddChild={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const foodRow = screen.getByRole("button", { name: "Expand Food" });
    const salaryRow = screen.getByRole("button", { name: "Edit Salary" });

    expect(screen.getByRole("region", { name: "Spending" }).contains(foodRow)).toBe(true);
    expect(screen.getByRole("region", { name: "Income" }).contains(salaryRow)).toBe(true);
    expect(foodRow.textContent).not.toContain("Spending");

    fireEvent.click(foodRow);

    expect(
      screen
        .getByRole("list", { name: "Subcategories of Food" })
        .classList.contains("overflow-hidden"),
    ).toBe(true);
  });
});
