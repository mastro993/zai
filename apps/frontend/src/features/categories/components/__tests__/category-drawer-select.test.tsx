// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TransactionCategory } from "../../types/model";
import { CategoryDrawerSelect } from "../category-drawer-select";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

const food = {
  id: "food",
  parentId: null,
  name: "Food",
  role: "spending",
} as TransactionCategory;

const groceries = {
  id: "groceries",
  parentId: "food",
  name: "Groceries",
  role: "spending",
  parent: food,
} as TransactionCategory;

const categories = [food, groceries];

describe("CategoryDrawerSelect", () => {
  afterEach(() => cleanup());

  it("commits multi selection only on Done", () => {
    const onChange = vi.fn();

    render(
      <CategoryDrawerSelect
        id="cats"
        mode="multiple"
        categories={categories}
        value={[]}
        onChange={onChange}
        placeholder="All categories"
        ariaLabel="Choose categories"
        drawerTitle="Select categories"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose categories" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Food" }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onChange).toHaveBeenCalledWith(["food"]);
  });

  it("discards multi draft on Back", () => {
    const onChange = vi.fn();

    render(
      <CategoryDrawerSelect
        id="cats"
        mode="multiple"
        categories={categories}
        value={[]}
        onChange={onChange}
        placeholder="All categories"
        ariaLabel="Choose categories"
        drawerTitle="Select categories"
        backAriaLabel="Back"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose categories" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Food" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Choose categories" }).textContent).toContain(
      "All categories",
    );
  });

  it("commits single selection immediately", () => {
    const onChange = vi.fn();

    render(
      <CategoryDrawerSelect
        id="cat"
        mode="single"
        categories={categories}
        value={null}
        onChange={onChange}
        placeholder="Uncategorized"
        ariaLabel="Choose category"
        drawerTitle="Select category"
        clearable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose category" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Food" }));
    fireEvent.click(screen.getByRole("option", { name: "Groceries" }));
    expect(onChange).toHaveBeenCalledWith("groceries");
  });

  it("clears single selection when clearable", () => {
    const onChange = vi.fn();

    render(
      <CategoryDrawerSelect
        id="cat"
        mode="single"
        categories={categories}
        value="food"
        onChange={onChange}
        placeholder="Uncategorized"
        ariaLabel="Choose category"
        drawerTitle="Select category"
        clearable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose category" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
