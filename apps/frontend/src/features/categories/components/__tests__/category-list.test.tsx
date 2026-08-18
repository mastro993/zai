// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { categorySchema } from "../../types/model";
import { CategoryList } from "../category-list";

const food = categorySchema.parse({
  id: "food",
  parentId: null,
  name: "Food",
  description: null,
  color: "#C32828",
  role: "spending",
  parent: null,
});

const groceries = categorySchema.parse({
  id: "groceries",
  parentId: "food",
  name: "Groceries",
  description: null,
  color: null,
  role: "spending",
  parent: food,
});

const salary = categorySchema.parse({
  id: "salary",
  parentId: null,
  name: "Salary",
  description: null,
  color: "#28C34E",
  role: "income",
  parent: null,
});

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

  it("hides the child count while a parent is expanded and restores it when collapsed", async () => {
    render(
      <CategoryList
        categories={[food, groceries]}
        onAddChild={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const foodRow = screen.getByRole("button", { name: "Expand Food" });

    expect(screen.getByText("+1")).toBeTruthy();

    fireEvent.click(foodRow);

    await waitFor(() => expect(screen.queryByText("+1")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Collapse Food" }));

    expect(screen.getByText("+1")).toBeTruthy();
  });
});
