// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TransactionCategory } from "@/features/categories/types/model";

import { TransactionCategoryCombobox } from "../transaction-category-combobox";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to }: { children: ReactNode; className?: string; to?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

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

const salary = {
  id: "salary",
  parentId: null,
  name: "Salary",
  role: "income",
  color: "#28C34E",
} as TransactionCategory;

describe("TransactionCategoryCombobox", () => {
  afterEach(() => cleanup());

  it("searches categories and renders matching items as badges", () => {
    const onChange = vi.fn();

    render(
      <TransactionCategoryCombobox
        id="transaction-category-trigger"
        categories={[food, groceries, salary]}
        value={null}
        parentOpen
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Choose category" });
    expect(trigger.textContent).toContain("Uncategorized");

    fireEvent.click(trigger);
    fireEvent.change(screen.getByPlaceholderText("Search categories"), {
      target: { value: "groceries" },
    });

    const option = screen.getByRole("option", { name: "Food / Groceries" });
    expect(option.querySelector('[data-slot="badge"]')).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Salary" })).toBeNull();

    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith("groceries");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("clears the category through the uncategorized option", () => {
    const onChange = vi.fn();

    render(
      <TransactionCategoryCombobox
        id="transaction-category-trigger"
        categories={[food]}
        value={food.id}
        parentOpen
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Choose category" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Uncategorized" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("keeps category recovery available when no categories exist", () => {
    render(
      <TransactionCategoryCombobox
        id="transaction-category-trigger"
        categories={[]}
        value={null}
        parentOpen
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Choose category" }));

    const manageCategories = screen.getByRole("link", { name: "Manage categories" });
    expect(manageCategories.getAttribute("href")).toBe("/cash-flow/categories");
  });
});
