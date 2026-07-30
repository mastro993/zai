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

describe("CategoryList", () => {
  afterEach(() => cleanup());

  it("renders expandable child rows inside an animated panel", () => {
    render(
      <CategoryList
        categories={[food, groceries]}
        onAddChild={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand Food" }));

    expect(
      screen
        .getByRole("list", { name: "Subcategories of Food" })
        .classList.contains("overflow-hidden"),
    ).toBe(true);
  });
});
