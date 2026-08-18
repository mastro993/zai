// @vitest-environment jsdom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { categorySchema } from "@/features/categories/types/model";

import { TransactionCategoryCombobox } from "../transaction-category-combobox";

const food = categorySchema.parse({
  id: "food",
  parentId: null,
  name: "Food",
  role: "spending",
  color: "#C32828",
});

const groceries = categorySchema.parse({
  id: "groceries",
  parentId: "food",
  name: "Groceries",
  role: "spending",
  parent: food,
  color: "#C32828",
});

const salary = categorySchema.parse({
  id: "salary",
  parentId: null,
  name: "Salary",
  role: "income",
  color: "#28C34E",
});

async function renderWithRouter(ui: ReactNode) {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => ui,
  });
  const categoriesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cash-flow/categories",
    component: () => <div>Categories</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, categoriesRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

describe("TransactionCategoryCombobox", () => {
  afterEach(() => cleanup());

  it("searches categories and renders matching items as badges", async () => {
    const onChange = vi.fn();

    await renderWithRouter(
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

  it("places child categories directly after their parents", async () => {
    await renderWithRouter(
      <TransactionCategoryCombobox
        id="transaction-category-trigger"
        categories={[food, salary, groceries]}
        value={null}
        parentOpen
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Choose category" }));

    expect(screen.getAllByRole("option").map((option) => option.textContent?.trim())).toEqual([
      "Uncategorized",
      "Food",
      "Food / Groceries",
      "Salary",
    ]);
  });

  it("clears the category through the uncategorized option", async () => {
    const onChange = vi.fn();

    await renderWithRouter(
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

  it("keeps category recovery available when no categories exist", async () => {
    await renderWithRouter(
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
